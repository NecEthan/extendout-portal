"use client";

import { useState } from "react";
import { cn } from "cn";

export interface TabItem {
  value: string;
  label: string;
  content: React.ReactNode;
}

function Tabs({
  tabs,
  defaultValue,
  className,
}: {
  tabs: TabItem[];
  defaultValue?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value);
  const current = tabs.find((t) => t.value === active) ?? tabs[0];

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => {
          const selected = t.value === current?.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.value)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                selected
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}

export { Tabs };
