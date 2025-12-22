import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  console.log("Delete API called");

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    console.log("Token exists:", !!token);

    if (!token) {
      console.error("Missing BLOB_READ_WRITE_TOKEN environment variable");
      return NextResponse.json(
        { error: "Missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    // Parse JSON body
    // ใน App Router ต้องดึง body ผ่าน request.json()
    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "URLs array is required" },
        { status: 400 }
      );
    }

    console.log("URLs to delete:", urls);

    // Delete multiple blob files
    // เราใช้ Promise.all เพื่อลบหลายไฟล์พร้อมกันและจับ Error แยกแต่ละไฟล์
    const deletePromises = urls.map(async (url: string) => {
      try {
        await del(url, { token });
        console.log("Successfully deleted:", url);
        return { url, success: true };
      } catch (error: any) {
        console.error("Failed to delete:", url, error);
        return { url, success: false, error: error.message };
      }
    });

    const results = await Promise.all(deletePromises);

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(
      `Deletion complete: ${successful.length} successful, ${failed.length} failed`
    );

    return NextResponse.json({
      ok: true,
      deleted: successful.length,
      failed: failed.length,
      results,
    });
  } catch (e: any) {
    console.error("Delete error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}