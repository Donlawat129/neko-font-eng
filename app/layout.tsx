import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 👇 Import สิ่งที่เราทำไว้ก่อนหน้านี้
import { Toaster } from "@/app/components/ui/toaster";
import { AuthProvider } from "@/app/contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Neko Font",
  description: "Font preview tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        // 👇 เพิ่ม class 'font-sans' เพื่อให้ Tailwind ใช้ฟอนต์นี้เป็นหลัก
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {/* 👇 ครอบ AuthProvider และใส่ Toaster */}
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}