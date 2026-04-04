"use client";

import { Search } from "lucide-react";
import { detectDirection } from "@/lib/utils";

interface FilterSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  iconSize?: number;
}

export function FilterSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  iconSize = 13,
}: FilterSearchInputProps) {
  return (
    <div className="relative mb-3">
      <Search
        size={iconSize}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={detectDirection(value)}
        className={`w-full pl-8 pr-3 py-2 rounded-lg border-none bg-background text-sm text-foreground placeholder:text-muted-foreground !outline-none !ring-0 focus:shadow-md transition-all ${detectDirection(value) === "rtl" ? "font-arabic-family text-right" : ""}`}
      />
    </div>
  );
}
