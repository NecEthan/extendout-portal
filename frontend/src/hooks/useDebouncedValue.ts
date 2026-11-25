import { useEffect, useState } from "react";

/** `value`, once it has stopped changing for `delayMs` (e.g. search typing,
 * so the API isn't called on every key press). */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
