import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-parchment-300 border-t-gold-500",
        {
          sm: "h-4 w-4",
          md: "h-6 w-6",
          lg: "h-8 w-8",
        }[size],
        className
      )}
    />
  );
}
