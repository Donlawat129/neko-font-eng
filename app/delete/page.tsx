"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link"; // เปลี่ยนจาก react-router-dom
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import FontCard from "@/app/components/FontCard";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, where, deleteDoc, DocumentData } from "firebase/firestore";

interface FontDocument {
  id: string;
  family: string;
  url: string;
  isPublic: boolean;
}

// ✨ NEW: helper โหลดฟอนต์ให้พร้อมแสดงบนการ์ด
async function loadFontFace(
  family: string,
  url: string,
  opts?: { weight?: number | string; style?: string }
) {
  try {
    const ff = new FontFace(
      family,
      `url(${url})`,
      {
        weight: (opts?.weight ?? 400).toString(),
        style: opts?.style ?? "normal",
        display: "swap",
      }
    );
    await ff.load();
    (document as any).fonts.add(ff);
    return true;
  } catch (e) {
    console.warn("Failed to load font:", family, e);
    return false;
  }
}

export default function DeleteFontsPage() {
  const [customFonts, setCustomFonts] = useState<FontDocument[]>([]);
  const [selectedFonts, setSelectedFonts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 🔁 REPLACE the whole useEffect that fetches fonts
  useEffect(() => {
    let cancelled = false;

    const fetchAndLoadFonts = async () => {
      setIsLoading(true);
      try {
        const q = query(collection(db, "fonts"), where("isPublic", "==", true));
        const snap = await getDocs(q);

        const seen = new Set<string>();              // กันซ้ำ family เดิม
        const docs: FontDocument[] = [];

        // ดึงเอกสาร + โหลดฟอนต์จริง
        for (const d of snap.docs) {
          const data = d.data() as DocumentData;
          const family = data?.family;
          const url = data?.url;

          if (!family || !url || seen.has(family)) continue;

          await loadFontFace(family, url);           // 👈 โหลดฟอนต์ด้วย FontFace
          docs.push({ id: d.id, family, url, isPublic: !!data?.isPublic });
          seen.add(family);
        }

        if (!cancelled) setCustomFonts(docs);
      } catch (error) {
        console.error("Error fetching fonts:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAndLoadFonts();
    return () => { cancelled = true; };
  }, []);

  const handleFontSelect = (fontId: string) => {
    setSelectedFonts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fontId)) {
        newSet.delete(fontId);
      } else {
        newSet.add(fontId);
      }
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedFonts.size === 0) return;
    
    setIsDeleting(true);
    
    try {
      // Get selected font documents
      const selectedFontDocs = customFonts.filter(font => selectedFonts.has(font.id));
      
      // Extract URLs for blob deletion
      const urlsToDelete = selectedFontDocs.map(font => font.url).filter(Boolean);
      
      console.log("Selected fonts to delete:", selectedFontDocs);
      console.log("URLs to delete from blob:", urlsToDelete);

      // First, delete from Vercel Blob if there are URLs
      if (urlsToDelete.length > 0) {
        // เรียก API Route ของ Next.js
        const blobResponse = await fetch("/api/delete", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            urls: urlsToDelete
          })
        });

        if (!blobResponse.ok) {
          const errorData = await blobResponse.json();
          throw new Error(`Failed to delete from blob storage: ${errorData.error}`);
        }

        const blobResult = await blobResponse.json();
        console.log("Blob deletion result:", blobResult);
      }

      // Then delete from Firestore
      const deletePromises = selectedFontDocs.map(async (font) => {
        try {
          const q = query(collection(db, "fonts"), where("family", "==", font.family));
          const snap = await getDocs(q);
          const deleteDocPromises = snap.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deleteDocPromises);
          console.log("Successfully deleted from Firestore:", font.family);
          return { fontFamily: font.family, success: true };
        } catch (error) {
          console.error("Failed to delete from Firestore:", font.family, error);
          return { fontFamily: font.family, success: false, error };
        }
      });

      const firestoreResults = await Promise.all(deletePromises);
      
      const successfulDeletions = firestoreResults.filter(r => r.success);
      console.log(`Firestore deletion complete: ${successfulDeletions.length} successful`);

      // Update local state
      const remainingFonts = customFonts.filter(font => !selectedFonts.has(font.id));
      setCustomFonts(remainingFonts);
      
      // Update localStorage (เก็บแค่ชื่อ font families)
      const fontFamilies = remainingFonts.map(font => font.family);
      localStorage.setItem("customFonts", JSON.stringify(fontFamilies));
      
      // Clear selections
      setSelectedFonts(new Set());
      
      alert(`Successfully deleted ${successfulDeletions.length} font(s)`);
      
    } catch (error) {
      console.error("Error during deletion process:", error);
      alert(`Error deleting fonts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const sortedFonts = useMemo(() => {
    return [...customFonts].sort((a, b) => {
      const numA = parseInt(a.family.match(/\d+/)?.[0] || "0", 10);
      const numB = parseInt(b.family.match(/\d+/)?.[0] || "0", 10);
      return numA - numB;
    });
  }, [customFonts]);


    if (isLoading) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading fonts...</span>
          </div>
        </div>
      );
    }

  return (
    <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* ใช้ img หรือ Next Image ก็ได้ */}
                <div className="relative w-20 h-20">
                  <img src="/images/neko-font.jpg" alt="Logo" className="w-full h-full object-cover" />
                </div>
                  <div>
                    <h1 className="text-2xl font-bold">ลบฟอนต์</h1>
                    <p className="text-sm text-muted-foreground">
                    เลือกฟอนต์ที่ต้องการลบออก
                    </p>
                  </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                <Link href="/fonts/add">
                    <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    กลับไปที่เพิ่มฟอนต์
                    </Button>
                  </Link>
                
                {selectedFonts.size > 0 && (
                <Button 
                    onClick={handleDeleteSelected}
                    variant="destructive"
                    className="flex items-center gap-2"
                    disabled={isDeleting}
                >
                    {isDeleting ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        กำลังลบ...
                    </>
                    ) : (
                    <>
                        <Trash2 className="h-4 w-4" />
                        ลบฟอนต์ที่เลือก ({selectedFonts.size})
                    </>
                    )}
                </Button>
                )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
            {customFonts.length === 0 ? (
            <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                ยังไม่มีฟอนต์ที่อัปโหลดไว้
                </p>
                <Link href="/fonts/add">
                  <Button>อัพโหลดฟอนต์อันแรกของคุณ</Button>
                </Link>
            </div>
            ) : (
            <>
                <div className="mb-6">
                <p className="text-sm text-muted-foreground">
                    คลิกที่ฟอนต์เพื่อเลือกฟอนต์ที่ต้องการลบ | 
                    {selectedFonts.size > 0 && ` ${selectedFonts.size} ฟอนต์เลือกเพื่อลบ`}
                </p>
                </div>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {sortedFonts.map((font) => (
                <div
                  key={font.id}
                  className={`cursor-pointer transition-all duration-200 relative rounded-lg overflow-hidden border ${
                    selectedFonts.has(font.id) 
                      ? "ring-2 ring-destructive border-destructive bg-destructive/5" // เพิ่ม style ตอนถูกเลือก
                      : "border-transparent hover:border-gray-200"
                  }`}
                  onClick={() => handleFontSelect(font.id)}
                >
                  <FontCard
                    name={font.family}
                    fontClass="font-sans"
                    sample="Neko-Font-Eng"
                    sizeClass="text-lg"
                    style={{ fontFamily: `'${font.family}', ui-sans-serif, system-ui, sans-serif` }}
                  />
                  {selectedFonts.has(font.id) && (
                    <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md z-10">
                      <Trash2 className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </section>

            </>
            )}
        </main>
    </div>
  );
}