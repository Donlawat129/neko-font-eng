"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation"; // เปลี่ยนจาก react-router-dom
import Link from "next/link"; // เปลี่ยนจาก react-router-dom
import Image from "next/image"; // ใช้แทน img
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Separator } from "@/app/components/ui/separator";
import { useToast } from "@/app/components/ui/use-toast";
import { auth, db } from "@/app/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, FileText } from "lucide-react";

const DEFAULT_SAMPLE = "Neko-Font-Eng";

// helper: สร้าง slug ปลอดภัยสำหรับ path/ชื่อไฟล์
function slugify(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}

// helper: ตรวจสอบว่าไฟล์เป็น font file หรือไม่
function isValidFontFile(file: File): boolean {
  const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some(ext => fileName.endsWith(ext));
}

export default function AddFontForm() {
  const { toast } = useToast();
  const router = useRouter(); // ใช้ router ของ Next.js

  const [fontName, setFontName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [objectURL, setObjectURL] = useState<string | null>(null);
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const canRegister = useMemo(() => Boolean(fontName && file && isValidFontFile(file)), [fontName, file]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login"); // เปลี่ยน navigate เป็น router.replace
    } catch (e) {
      console.error(e);
      toast({ title: "Sign out failed", variant: "destructive" });
    }
  };

  // หมายเหตุ: ลบ useEffect ที่จัดการ SEO/Meta ออก แล้วย้ายไปทำใน layout.tsx หรือ page.tsx แบบ Server Component แทน

  useEffect(() => {
    return () => {
      if (objectURL && !confirmed) URL.revokeObjectURL(objectURL);
    };
  }, [objectURL, confirmed]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    
    if (f && !isValidFontFile(f)) {
      toast({
        title: "Invalid file type",
        description: "Please select a font file (.ttf, .otf, .woff, .woff2)",
        variant: "destructive"
      });
      e.target.value = ""; // Clear the input
      return;
    }

    setFile(f);
    setRegistered(false);
    setConfirmed(false);
    if (objectURL) {
      URL.revokeObjectURL(objectURL);
      setObjectURL(null);
    }
  };

  const registerFont = async () => {
    if (!canRegister || !file) return;
    try {
      setLoading(true);
      let url = objectURL;
      if (!url) {
        url = URL.createObjectURL(file);
        setObjectURL(url);
      }
      // FontFace เป็น Browser API ต้องรันใน useEffect หรือ event handler เท่านั้น (ซึ่ง function นี้ทำงานตอน click อยู่แล้ว จึงปลอดภัย)
      const ff = new FontFace(fontName, `url(${url})`);
      await ff.load();
      (document as any).fonts.add(ff);
      setRegistered(true);
      toast({ title: "Font ready", description: `${fontName} loaded for preview in this session.` });
    } catch (err) {
      console.error(err);
      toast({ title: "Could not load font", description: "Please ensure the file is a valid font.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const confirmFont = async () => {
    if (!registered || !fontName || !file) return;
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        toast({
          title: "Please sign in",
          description: "You must be logged in to add fonts.",
          variant: "destructive",
        });
        return;
      }

      const family = fontName.trim();
      const familySlug = slugify(family);
      const ext = (file.name.split(".").pop() || "woff2").toLowerCase();
      const variant = "regular";
      const weight = 400;
      const style = "normal";

      // 1) อัปโหลดไป Vercel Blob ผ่าน API Route ของ Next.js
      const fd = new FormData();
      fd.append("file", file);
      fd.append("prefix", `fonts/${familySlug}`);

      // หมายเหตุ: ต้องตรวจสอบว่าคุณสร้าง route handler ที่ /api/upload แล้วหรือยัง
      const upRes = await fetch("/api/upload", {
        method: "POST",
        headers: { 
          "x-user-id": user.uid
        },
        body: fd,
      });

      if (!upRes.ok) {
        const errorText = await upRes.text();
        throw new Error(`Upload failed: ${errorText}`);
      }
      
      const { url, pathname, contentType } = await upRes.json();

      // 2) บันทึก metadata ใน Firestore
      await addDoc(collection(db, "fonts"), {
        family,
        familySlug,
        variant,
        weight,
        style,
        ext,
        contentType: contentType || null,
        url,            // public URL จาก Vercel Blob
        path: pathname, // path ภายใน Blob
        userId: user.uid,
        isPublic: true,
        createdAt: serverTimestamp(),
        provider: "vercel-blob",
      });

      setConfirmed(true);
      toast({ title: "Uploaded", description: `${family} saved successfully.` });
    } catch (e: any) {
      console.error("Upload error:", e);
      toast({ 
        title: "Could not add font", 
        description: e.message || "Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-8 mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20">
                <img 
                  src="/images/neko-font.jpg" 
                  alt="Logo" 
                  className="object-cover w-full h-full"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-0">เพิ่มฟอนต์</h1>
                <p className="text-muted-foreground">
                  อัปโหลดฟอนต์ (TTF, OTF, WOFF, WOFF2) และดูตัวอย่างข้อความทันที
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">   
              <div className="flex items-center gap-4">
                  <Button asChild variant="destructive">
                    <Link href="/fonts/delete">
                      ลบฟอนต์
                    </Link>
                  </Button>
                  <Button onClick={handleLogout} variant="outline" className="px-4 py-2">
                    ลงชื่อออก
                  </Button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="container py-6 mx-auto px-4">
        <section aria-labelledby="upload" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle id="upload">อัพโหลดฟอนต์</CardTitle>
              <CardDescription>สนับสนุน: .ttf, .otf, .woff, .woff2</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="fontName">ชื่อฟอนต์</Label>
                <Input
                  id="fontName"
                  placeholder="ฟอนต์ของฉัน"
                  value={fontName}
                  onChange={(e) => setFontName(e.target.value)}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="fontFile">ไฟล์ฟอนต์</Label>
                  <div className="relative">
                    <Input                    
                      id="fontFile"                    
                      type="file"                    
                      accept=".ttf,.otf,.woff,.woff2"                    
                      onChange={handleFileChange}             
                    />
                  </div>
                {file && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    Selected: {file.name} ({Math.round(file.size / 1024)}KB)
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={registerFont} disabled={!canRegister || loading} aria-disabled={!canRegister || loading}>
                  {loading ? "กำลังโหลด…" : registered ? "โหลดฟอนต์อีกรอบ" : "โหลดฟอนต์"}
                </Button>
                {registered && (
                  <Button 
                    variant="default" 
                    onClick={confirmFont} 
                    disabled={confirmed || loading} 
                    aria-disabled={confirmed || loading} 
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {loading ? "กำลังอัพเดท..." : confirmed ? "เพิ่มแล้ว ✓" : "บันทึกฟอนต์"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ตัวอย่าง</CardTitle>
              <CardDescription>พิมพ์ข้อความเพื่อดูว่าฟอนต์ของคุณแสดงผลอย่างไร</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="sample">ข้อความตัวอย่าง</Label>
                <Input id="sample" value={sample} onChange={(e) => setSample(e.target.value)} placeholder={DEFAULT_SAMPLE} />
              </div>
              <Separator />
              <div className="rounded-md border bg-card p-4">
                <p className="mb-2 text-sm text-muted-foreground">Live ตัวอย่าง</p>
                <div
                  className="leading-snug break-words"
                  style={{
                    fontFamily: registered && fontName ? `'${fontName}', ui-sans-serif, system-ui, sans-serif` : undefined,
                    fontSize: "1.75rem",
                  }}
                >
                  {sample || DEFAULT_SAMPLE}
                </div>
                {!registered && <p className="mt-2 text-xs text-muted-foreground">โหลดฟอนต์เพื่อเปิดใช้งานการแสดงตัวอย่าง</p>}
              </div>
            </CardContent>
          </Card>
          
          <div className="col-span-1 lg:col-span-2">
            <Button asChild variant="ghost" size="lg">
                <Link href="/" className="flex items-center">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    กลับไปที่หน้าหลัก
                </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};