"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link"; 
import Image from "next/image"; 
import { collection, getDocs, query, where } from "firebase/firestore";
import * as htmlToImage from "html-to-image";
import { db } from "@/app/lib/firebase";
import FontCard from "@/app/components/FontCard";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

const STORAGE_KEY_PER_SIZE = "perSizePx.v1";

// ---------- Config ----------
const SIZE_MAP: Record<string, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-4xl",
};

// ค่า default เป็น px สำหรับแต่ละ size
const BASE_PX: Record<keyof typeof SIZE_MAP, number> = {
  sm: 18,
  md: 24,
  lg: 30,
  xl: 36,
};

// ---------- Helpers for embedding fonts into export ----------
type FontMeta = {
  family: string;
  url: string;
  weight?: number;
  style?: string;
};

const fontFormatFromUrl = (url: string) => {
  const u = url.toLowerCase();
  if (u.endsWith(".woff2")) return "woff2";
  if (u.endsWith(".woff")) return "woff";
  if (u.endsWith(".ttf")) return "truetype";
  if (u.endsWith(".otf")) return "opentype";
  return "woff2";
};

const buildFontFaceCSS = (metas: FontMeta[]) =>
  metas
    .map(
      (m) => `
@font-face{
  font-family:'${m.family}';
  src:url('${m.url}') format('${fontFormatFromUrl(m.url)}');
  font-weight:${m.weight ?? 400};
  font-style:${m.style ?? "normal"};
  font-display:swap;
}`
    )
    .join("\n");

const injectExportFonts = (container: HTMLElement, metas: FontMeta[]) => {
  const style = document.createElement("style");
  style.setAttribute("data-export-fonts", "true");
  style.textContent = buildFontFaceCSS(metas);
  container.prepend(style);
  return () => style.remove();
};

function withTimeout<T>(p: Promise<T>, ms = 6000) {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("Font load timeout")), ms)
    ),
  ]);
}

async function ensureExportFontsLoaded(metas: FontMeta[], sample: string) {
  const requests = metas.map((m) => {
    const weight = m.weight ?? 400;
    const desc = `${weight} 64px "${m.family}"`;
    try {
      return (document as any).fonts.load(desc, sample || "あกขabc123");
    } catch {
      return Promise.resolve([]);
    }
  });

  await Promise.all(requests);
  try {
    await (document as any).fonts.ready;
  } catch {}
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  await withTimeout(Promise.all(requests));
  try {
    await withTimeout((document as any).fonts.ready);
  } catch {}
}

// ---------- Page ----------
export default function Index() {
  const [text, setText] = useState("Neko-Font-Eng");
  const [size, setSize] = useState<keyof typeof SIZE_MAP>("md");

  // data / states
  const [loading, setLoading] = useState(true);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [fontMetas, setFontMetas] = useState<FontMeta[]>([]);

  const [activeFont, setActiveFont] = useState<string | null>(null);

  // export modal
  const [exportOpen, setExportOpen] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState(0);

  // Initialize with empty object to prevent Hydration Mismatch
  const [perSizePx, setPerSizePx] = useState<Record<string, number>>({});

  // helper: px ที่ใช้กับแต่ละการ์ด
  const getPx = (name: string) => perSizePx[name] ?? BASE_PX[size];
  const activePx = activeFont
    ? perSizePx[activeFont] ?? BASE_PX[size]
    : BASE_PX[size];

  // Load localStorage on mount (Client-side only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PER_SIZE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setPerSizePx(parsed);
        }
      }
    } catch {}
  }, []);

  // Save to localStorage
  useEffect(() => {
    // Don't save empty state on initial render if we haven't loaded yet
    if (Object.keys(perSizePx).length === 0) return;

    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_PER_SIZE, JSON.stringify(perSizePx));
      } catch {}
    }, 200);
    return () => clearTimeout(id);
  }, [perSizePx]);

  // ---------- Load published fonts from Firestore ----------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const q = query(collection(db, "fonts"), where("isPublic", "==", true));
        const snap = await getDocs(q);

        const seen = new Set<string>();
        const loadedFamilies: string[] = [];
        const metaMap = new Map<string, FontMeta>();

        for (const doc of snap.docs) {
          const d = doc.data() as {
            family: string;
            url: string;
            weight?: number;
            style?: string;
          };
          if (!d?.family || !d?.url) continue;

          try {
            const ff = new FontFace(d.family, `url(${d.url})`, {
              weight: (d.weight ?? 400).toString(),
              style: d.style ?? "normal",
              display: "swap",
            });
            await ff.load();
            (document as any).fonts.add(ff);
            if (!seen.has(d.family)) {
              loadedFamilies.push(d.family);
              seen.add(d.family);
            }
          } catch (e) {
            console.error("Failed to load font:", d.family, e);
          }

          const key = `${d.family}-${d.weight ?? 400}-${d.style ?? "normal"}`;
          if (!metaMap.has(key)) {
            metaMap.set(key, {
              family: d.family,
              url: d.url,
              weight: d.weight,
              style: d.style,
            });
          }
        }

        if (!cancelled) {
          setCustomFonts(loadedFamilies);
          setFontMetas(Array.from(metaMap.values()));
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedFonts = useMemo(() => {
    return [...customFonts].sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });
  }, [customFonts]);

  // ---------- Modal prep ----------
  useEffect(() => {
    if (!exportOpen) return;
    let alive = true;

    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    (async () => {
      setExportReady(false);
      try {
        await (document as any).fonts?.ready;
      } catch {}
      if (!alive) return;
      requestAnimationFrame(() => setExportReady(true));
    })();

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [exportOpen]);

  // ---------- Export ----------
  async function captureFullNodeToPng(
    node: HTMLElement,
    metas: FontMeta[],
    filename = "Neko-Font-Eng.png"
  ) {
    if ((document as any).fonts?.ready) {
      try {
        await (document as any).fonts.ready;
      } catch {}
    }
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const width = Math.ceil(node.scrollWidth);
    const height = Math.ceil(node.scrollHeight);

    const MAX = 16384;
    let pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      MAX / width,
      MAX / height,
      2
    );
    pixelRatio = Math.max(pixelRatio, 0.75);

    const cleanup = injectExportFonts(node, metas);

    try {
      await ensureExportFontsLoaded(
        metas,
        (node.textContent || "").slice(0, 64)
      );
      void node.offsetHeight;

      const dataUrl = await htmlToImage.toPng(node, {
        backgroundColor: "#ffffff",
        width,
        height,
        pixelRatio,
        cacheBust: true,
        skipFonts: false,
        style: {
          transform: "none",
          width: `${width}px`,
          height: `${height}px`,
          overflow: "visible",
          background: "#ffffff",
        },
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } finally {
      cleanup();
    }
  }

  // Cleanup perSizePx keys based on available fonts
  useEffect(() => {
    if (!customFonts.length) return;
    setPerSizePx((prev) => {
      // ถ้า prev ว่างเปล่า (ยังไม่โหลด local storage) ไม่ต้องทำอะไร
      if (Object.keys(prev).length === 0) return prev;

      const allowed = new Set(customFonts);
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (allowed.has(k)) next[k] = v;
      }
      return next;
    });
  }, [customFonts]);

  return (
    <div
      className="min-h-screen bg-background"
      onClick={() => setActiveFont(null)}
    >
      {/* Header */}
      <header className="border-b">
        <div className="container py-8 relative mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20">
                <Image
                  src="/images/neko-font.jpg" // Next.js จะไปหาไฟล์นี้ที่ public/images/neko-font.jpg
                  alt="Logo"
                  fill // ใช้ fill เพื่อให้รูปขยายเต็มพ่อแม่ (div w-20 h-20)
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // ช่วยเรื่อง SEO และ Performance
                  className="object-cover rounded-lg" // เพิ่ม rounded ได้ถ้าต้องการ
                  priority // ใส่ priority ถ้าเป็นรูป logo ด้านบน เพื่อให้โหลดก่อนส่วนอื่น
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  เครื่องมือแสดงตัวอย่างฟอนต์
                </h1>
                <p className="mt-2 text-muted-foreground">
                  พิมพ์ข้อความครั้งเดียวและดูตัวอย่างข้อความของคุณในฟอนต์ต่างๆ
                </p>
              </div>
            </div>

            {/* ปุ่ม + สไลเดอร์ส่วนกลาง */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="font-bold">
                {activeFont ? `ฟอนต์ที่ : ${activeFont}` : "กรุณาเลือกฟอนต์"}
              </div>

              <div
                className="bg-white/90 backdrop-blur-sm border rounded-xl p-2 shadow pointer-events-auto z-20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 w-full sm:w-[350px]">
                  <input
                    type="range"
                    min={12}
                    max={96}
                    step={1}
                    disabled={!activeFont}
                    value={activePx}
                    onChange={(e) => {
                      if (!activeFont) return;
                      setPerSizePx((p) => ({
                        ...p,
                        [activeFont]: Number(e.target.value),
                      }));
                    }}
                    className="w-full"
                    aria-label="ปรับขนาดการ์ดที่เลือก"
                  />
                  <span className="font-bold w-12 text-right tabular-nums">
                    {activePx} px
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setExportOpen(true)}
                  disabled={loading || sortedFonts.length === 0}
                >
                  Export PNG
                </Button>
                <Button asChild>
                  <Link href="/fonts/add" aria-label="Add a custom font">
                    เพิ่มฟอนต์
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Controls */}
      <main className="container py-6 mx-auto px-4">
        <section aria-labelledby="controls" className="mb-6">
          <h2 id="controls" className="sr-only">
            Preview controls
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                aria-label="Preview text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="พิมพ์ข้อความของคุณที่นี่…"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={size}
                onValueChange={(v) => setSize(v as keyof typeof SIZE_MAP)}
              >
                <SelectTrigger aria-label="Text size">
                  <SelectValue placeholder="Text size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">เล็ก</SelectItem>
                  <SelectItem value="md">กลาง</SelectItem>
                  <SelectItem value="lg">ใหญ่</SelectItem>
                  <SelectItem value="xl">ใหญ่มาก</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Grid */}
        <section aria-labelledby="grid">
          <h2 id="grid" className="sr-only">
            Font previews
          </h2>

          {loading && (
            <p className="mb-4 text-sm text-muted-foreground">
              กำลังโหลดฟอนต์จากฐานข้อมูล…
            </p>
          )}

          {!loading && sortedFonts.length === 0 && (
            <p className="mb-4 text-sm text-muted-foreground">
              ยังไม่มีฟอนต์ที่เผยแพร่ — กด{" "}
              <Link href="/fonts/add" className="underline">
                เพิ่มฟอนต์
              </Link>{" "}
              เพื่อเพิ่มฟอนต์
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
            {sortedFonts.map((name) => (
              <div
                key={`grid-${name}`}
                className={`relative cursor-pointer self-start ${
                  activeFont === name
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg"
                    : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFont((cur) => (cur === name ? null : name));
                }}
              >
                <FontCard
                  name={name}
                  fontClass=""
                  sample={text || ""}
                  sizeClass={SIZE_MAP[size]}
                  style={{
                    fontFamily: `'${name}', ui-sans-serif, system-ui, sans-serif`,
                    fontSize: `${getPx(name)}px`,
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Export Modal */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* header */}
            <div className="flex items-center justify-between p-4 border-b bg-white">
              <h2 className="text-lg font-semibold">
                Preview (สำหรับบันทึกเป็น PNG)
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="font-semibold"
                  disabled={!exportReady || countdown > 0}
                  onClick={async () => {
                    if (!exportRef.current) return;
                    try {
                      await captureFullNodeToPng(
                        exportRef.current,
                        fontMetas,
                        "Neko-Font-Eng.png"
                      );
                    } catch (err) {
                      console.error(err);
                      alert("บันทึก PNG ไม่สำเร็จ");
                    }
                  }}
                >
                  {!exportReady
                    ? "กำลังเตรียม…"
                    : countdown > 0
                    ? `รอ ${countdown}s`
                    : "Save PNG"}
                </Button>
                <Button onClick={() => setExportOpen(false)}>ปิด</Button>
              </div>
            </div>

            {/* scrollable body */}
            <div className="overflow-auto p-6 flex-1 bg-gray-50">
              <div ref={exportRef} className="bg-white p-6 min-h-full">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
                  {sortedFonts.map((name) => (
                    <FontCard
                      key={`export-${name}`}
                      name={name}
                      fontClass=""
                      sample={text || ""}
                      sizeClass={SIZE_MAP[size]}
                      style={{
                        fontFamily: `'${name}', ui-sans-serif, system-ui, sans-serif`,
                        fontSize: `${getPx(name)}px`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
