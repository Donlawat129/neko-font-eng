import React from "react";
import { cn } from "@/app/lib/utils";

interface FontCardProps {
  name: string;
  fontClass: string;
  sample: string;
  sizeClass: string;
  style?: React.CSSProperties;
}

const FontCard = ({ name, fontClass, sample, sizeClass, style }: FontCardProps) => {
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-ring/50"
      )}
      // หมายเหตุ: การใส่ style ที่นี่จะทำให้ Card ทั้งใบรับค่า CSS ไปด้วย
      // ถ้าต้องการให้เปลี่ยนแค่ฟอนต์ของข้อความตัวอย่าง อาจจะลบ style ตรงนี้ออกแล้วใส่แค่ที่ <p> ด้านล่าง
      style={style} 
      tabIndex={0}
      aria-label={`${name} font preview`}
    >
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          {/* ชื่อฟอนต์ (Title) มักจะใช้ฟอนต์ปกติของเว็บ ไม่ใช่ฟอนต์ที่พรีวิว */}
          <h3 className="text-sm font-medium text-muted-foreground font-sans">
            {name}
          </h3>
        </div>
        {/* ส่วนแสดงผลตัวอย่างฟอนต์ */}
        <p 
          className={cn("leading-snug break-words", fontClass, sizeClass)} 
          style={style}
        >
          {sample}
        </p>
      </div>
      
      {/* Effect แสงเงาเวลา Hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
        <div className="absolute -inset-12 bg-gradient-to-tr from-foreground/[0.03] to-transparent rotate-6" />
      </div>
    </article>
  );
};

export default FontCard;