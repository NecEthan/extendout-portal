import { Sparkles } from "lucide-react";

export function MockBanner() {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-accent/60 px-3 py-2 text-xs text-accent-foreground">
      <Sparkles size={14} />
      Preview: this section shows sample data while the feature is being built.
    </div>
  );
}
