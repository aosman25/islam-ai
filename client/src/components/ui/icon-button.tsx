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
              "text-muted-foreground hover:text-foreground hover:bg-muted",
            outline:
              "border border-border text-muted-foreground hover:bg-muted hover:border-border",
            filled:
              "bg-primary text-white hover:bg-secondary shadow-sm",
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
