"use client"; // <--- สำคัญมาก! ต้องใส่บรรทัดนี้

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ 
  user: null, 
  loading: true, 
  logout: async () => {} 
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe ทันทีที่ Component ถูก mount
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    // Unsubscribe เมื่อ unmount
    return () => unsub();
  }, []);

  const logout = async () => {
    await signOut(auth);
    // ใน Next.js คุณอาจจะอยาก redirect ไปหน้า login ด้วยก็ได้
    // router.push("/login"); 
  };

  return (
    <Ctx.Provider value={{ user, loading, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}