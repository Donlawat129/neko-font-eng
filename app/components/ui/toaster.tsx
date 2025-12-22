"use client"

// 👇 แก้ไขบรรทัดนี้: เปลี่ยนจาก "@/hooks/use-toast" เป็น "./use-toast"
import { useToast } from "./use-toast" 

// 👇 แก้ไขบรรทัดนี้: เปลี่ยนจาก "@/components/ui/toast" เป็น "./toast" (เพื่อให้ชัวร์)
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}