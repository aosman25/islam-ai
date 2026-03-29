import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "ghost" | "outline" | "filled";
  size?: "sm" | "md" | "lg";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "ghost", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none",
          {
            ghost:
              "text-ink-500 hover:text-ink-800 hover:bg-parchment-200/60",
            outline:
              "border border-border text-ink-600 hover:bg-parchment-100 hover:border-parchment-400",
            filled:
              "bg-gold-600 text-white hover:bg-gold-700 shadow-soft",
          }[variant],
          {
            sm: "h-8 w-8",
            md: "h-9 w-9",
            lg: "h-10 w-10",
          }[size],
          className
        )}
        {...props}
      />
    );
  }
);

IconButton.displayName = "IconButton";
