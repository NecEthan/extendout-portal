"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const listRef = useRef<HTMLDivElement>(null);
  // Phones and tablets (below lg) show every tab as a button in a grid, so
  // nothing is hidden. From lg up it's an underlined tab bar that scrolls sideways if
  // it doesn't fit; fade whichever edge has more tabs behind it.
  const [more, setMore] = useState({ left: false, right: false });

  const updateFade = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const left = list.scrollLeft > 1;
    const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
    setMore((m) =>
      m.left === left && m.right === right ? m : { left, right }
    );
  }, []);

  useEffect(() => {
    updateFade();
    window.addEventListener("resize", updateFade);
    return () => window.removeEventListener("resize", updateFade);
  }, [updateFade, tabs.length]);

  // Keep the selected tab visible (e.g. Settings opened from a link).
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !selected) return;
    const tabLeft = selected.offsetLeft - list.offsetLeft;
    if (
      tabLeft < list.scrollLeft ||
      tabLeft + selected.offsetWidth > list.scrollLeft + list.clientWidth
    ) {
      list.scrollLeft = tabLeft - 16;
    }
    updateFade();
  }, [current?.value, updateFade]);

  const fade =
    more.left && more.right
      ? "lg:[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]"
      : more.right
        ? "lg:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]"
        : more.left
          ? "lg:[mask-image:linear-gradient(to_right,transparent,black_2rem)]"
          : "";
  // Full rows in the grid: 3 per row for 3 or 6 tabs (admins), else 2.
  const phoneColumns = tabs.length % 3 === 0 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div
        ref={listRef}
        role="tablist"
        onScroll={updateFade}
        className={cn(
          "grid gap-2 lg:flex lg:gap-1 lg:overflow-x-auto lg:border-b lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden",
          phoneColumns,
          fade
        )}
      >
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
                // Below lg: rounded button; selected is filled.
                "min-w-0 truncate rounded-lg border px-1 py-2.5 text-center text-sm whitespace-nowrap transition-colors",
                // lg and up: underlined tab.
                "lg:-mb-px lg:shrink-0 lg:rounded-none lg:border-0 lg:border-b-2 lg:bg-transparent lg:px-3 lg:py-2",
                selected
                  ? "border-primary bg-primary font-medium text-primary-foreground lg:border-primary lg:text-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground lg:border-transparent"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="min-w-0">
        {current?.content}
      </div>
    </div>
  );
}

export { Tabs };
