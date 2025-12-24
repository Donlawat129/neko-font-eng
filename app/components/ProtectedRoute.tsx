// ProtectedRoute.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); // ใช้แทน useLocation

  useEffect(() => {
    // ถ้าโหลดเสร็จแล้ว และไม่มี User ให้ดีดไป Login
    if (!loading && !user) {
      // ใช้ Query Param (?from=...) แทน state={{ from: ... }}
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, router, pathname]);

  // ขณะกำลังโหลด หรือกำลัง Redirect ไม่ต้องแสดงเนื้อหา
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return null;

  // ถ้ามี User แสดงเนื้อหาได้เลย
  return <>{children}</>;
}