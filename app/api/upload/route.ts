import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // 1. Check Method (ใน App Router ถ้า export POST มันจะรับแค่ POST อัตโนมัติ แต่เช็คไว้ก็ได้)
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    
    if (!token) {
      console.error("Missing BLOB_READ_WRITE_TOKEN environment variable");
      return NextResponse.json({ error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });
    }

    // 2. Parse FormData (แทน formidable)
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const prefix = (formData.get("prefix") as string) || "";

    if (!file) {
      console.error("No file provided");
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // 3. Validation
    const fileName = file.name.toLowerCase();
    console.log("File received:", file.name, file.size, file.type);
    console.log("Prefix:", prefix);

    // Validate Extension
    const allowedExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
    const isValidFont = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidFont) {
      return NextResponse.json({
        error: "Unsupported file type. Please upload .ttf, .otf, .woff, or .woff2 files."
      }, { status: 415 });
    }

    // 4. Determine Content Type
    // (Logic เดิม: ถ้าเป็น octet-stream ให้เดาจากนามสกุล)
    let contentType = file.type;
    if (!contentType || contentType === 'application/octet-stream') {
      if (fileName.endsWith('.ttf')) contentType = 'font/ttf';
      else if (fileName.endsWith('.otf')) contentType = 'font/otf';
      else if (fileName.endsWith('.woff')) contentType = 'font/woff';
      else if (fileName.endsWith('.woff2')) contentType = 'font/woff2';
      else contentType = 'application/octet-stream';
    }

    // 5. Generate Path
    const uid = getUidFromRequest(request) ?? "anonymous";
    const slug = Math.random().toString(36).substring(2, 10);
    // เปลี่ยนการ replace regex เล็กน้อยให้ปลอดภัยขึ้น
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${prefix ? prefix + "/" : ""}${uid}/${slug}/${safeName}`;

    console.log("Uploading to path:", path, "Content-Type:", contentType);

    // 6. Upload to Vercel Blob
    // put() ใน App Router รับ File Object ได้เลย ไม่ต้องแปลงเป็น Buffer
    const blob = await put(path, file, {
      access: "public",
      token,
      contentType,
      addRandomSuffix: true,
    });

    console.log("Upload successful:", blob.url);

    return NextResponse.json({
      ok: true,
      url: blob.url,
      pathname: blob.pathname,
      size: file.size,
      contentType,
    });

  } catch (e: any) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper: ดึง User ID จาก Header หรือ Cookie
function getUidFromRequest(request: Request): string | null {
  const headers = request.headers;
  const headerUid = headers.get("x-user-id");
  
  if (headerUid && headerUid.trim()) return headerUid.trim();

  const cookieHeader = headers.get("cookie") || "";
  const m = cookieHeader.match(/(?:^|;\s*)uid=([^;]+)/);
  if (m && m[1]) return decodeURIComponent(m[1]);
  
  return null;
}