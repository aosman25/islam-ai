"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: LucideIcon;
  label: string;
  error?: string;
}

export function AuthInput({ icon: Icon, label, error, id, className, onInvalid, ...props }: AuthInputProps) {
  const [validationError, setValidationError] = useState("");
  const displayError = error || validationError;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon
          size={16}
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 transition-colors",
            displayError ? "text-destructive" : "text-muted-foreground"
          )}
        />
        <input
          id={id}
          className={cn(
            "w-full rounded-lg border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors",
            displayError
              ? "border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive"
              : "border-input focus:border-primary focus:ring-1 focus:ring-primary",
            className
          )}
          onInvalid={(e) => {
            e.preventDefault();
            const input = e.target as HTMLInputElement;
            if (input.validity.valueMissing) {
              setValidationError(`${label} is required`);
            } else if (input.validity.typeMismatch) {
              setValidationError(`Please enter a valid ${label.toLowerCase()}`);
            } else if (input.validity.tooShort) {
              setValidationError(`${label} must be at least ${input.minLength} characters`);
            } else {
              setValidationError(input.validationMessage);
            }
            onInvalid?.(e);
          }}
          onChange={(e) => {
            if (validationError) setValidationError("");
            props.onChange?.(e);
          }}
          {...props}
        />
      </div>
      {displayError && (
        <p className="text-xs text-destructive animate-fade-in">{displayError}</p>
      )}
    </div>
  );
}
