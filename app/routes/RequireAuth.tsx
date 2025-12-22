"use client"; // จำเป็นต้องใส่เพราะมีการใช้ Hooks

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation"; // เปลี่ยน library
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/app/lib/firebase";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname(); // ใช้สำหรับจำ path ปัจจุบัน

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        // ถ้าไม่มี User ให้ดีดไป Login
        // ใช้ Query Param แทน state เพื่อความชัวร์ใน Next.js
        router.replace(`/login?from=${encodeURIComponent(pathname)}`);
      } else {
        setUser(u);
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router, pathname]);

  // แสดง Loading ระหว่างเช็คสถานะ (ป้องกันหน้าจอกระพริบหรือ Content หลุด)
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="text-muted-foreground">Checking authentication...</div>
      </div>
    );
  }

  // ถ้าเช็คเสร็จแล้วแต่ไม่มี User (กำลัง redirect) ก็ไม่ต้อง render อะไร
  if (!user) return null;

  // ผ่านแล้ว -> render children
  return <>{children}</>;
}