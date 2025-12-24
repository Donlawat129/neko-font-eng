// app/login/page.tsx
"use client"; // จำเป็นต้องใส่เพราะมี useState และ Interactive Elements

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/app/lib/firebase"; // ตรวจสอบ path ให้ถูกต้อง
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  GoogleAuthProvider 
} from "firebase/auth";

// แยก Component เนื้อหาออกมาเพื่อรองรับ Suspense (Best Practice ของ Next.js)
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // รับค่า path ที่จะให้เด้งกลับไป จาก URL ?from=... ถ้าไม่มีให้ไปหน้าแรก "/"
  const from = searchParams.get("from") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loginGoogle = async () => {
    try {
      setBusy(true); 
      setErr(null);
      // สร้าง Provider ตรงนี้ หรือจะ import มาก็ได้
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      
      router.replace(from); // redirect
    } catch (e: any) { 
      setErr(e.message ?? "Sign in failed"); 
    } finally { 
      setBusy(false); 
    }
  };

  const loginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true); 
      setErr(null);
      await signInWithEmailAndPassword(auth, email, password);
      
      router.replace(from); // redirect
    } catch (e: any) { 
      setErr(e.message ?? "Sign in failed"); 
    } finally { 
      setBusy(false); 
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-sm text-muted-foreground mt-1">Use your account</p>

      <form onSubmit={loginEmail} className="mt-6 space-y-3">
        <input 
          className="w-full rounded-md border px-3 py-2 bg-background" 
          type="email" 
          placeholder="Email"
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
        />
        <input 
          className="w-full rounded-md border px-3 py-2 bg-background" 
          type="password" 
          placeholder="Password"
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
        />
        <button 
          className="w-full rounded-md bg-primary text-primary-foreground py-2 disabled:opacity-60 hover:bg-primary/90 transition-colors"
          disabled={busy} 
          type="submit"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-4 text-center text-sm text-muted-foreground">or</div>

      <button 
        onClick={loginGoogle}
        className="w-full rounded-md border py-2 hover:bg-accent disabled:opacity-60 transition-colors"
        disabled={busy}
      >
        Continue with Google
      </button>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-6 text-center text-sm">
        <Link href="/" className="text-primary hover:underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}

// Main Page Component
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      {/* Suspense จำเป็นสำหรับ page ที่มีการใช้ useSearchParams ใน Next.js */}
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}