import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A native <select> with our own arrow, inset from the right edge like the
 * text is from the left (the browser's arrow sits tight against the border). */
export function NativeSelect({
  className,
  ...props
}: ComponentProps<"select">) {
  return (
    <span className="relative inline-grid min-w-0">
      <select
        className={cn("min-w-0 appearance-none truncate", className, "pr-8")}
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}
