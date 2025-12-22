"use client" 
// *แนะนำให้ใส่ "use client" ไว้ครับ เพราะ Radix UI มักมีการใช้ Ref และ Event Handling 
// ซึ่ง Next.js App Router จะต้องการให้เป็น Client Component (แม้บางทีมันจะทำงานได้โดยไม่ต้องใส่ก็ตาม แต่ใส่ไว้ชัวร์กว่าสำหรับ UI Library)

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/app/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }