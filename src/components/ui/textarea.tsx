import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-y rounded-lg border border-border bg-bg px-4 py-3 font-mono text-sm text-fg shadow-none outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-subtle focus-visible:border-fg/40 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}
