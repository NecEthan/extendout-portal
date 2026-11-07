import { Camera } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { SitePhoto } from "@/interfaces/portal-interface";

/** Placeholder photo tile (gradient) until real uploads exist. */
export function PhotoTile({ photo }: { photo: SitePhoto }) {
  return (
    <figure className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div
        className={`grid aspect-[4/3] place-items-center bg-gradient-to-br ${photo.tone}`}
      >
        <Camera className="text-foreground/25" size={28} />
      </div>
      <figcaption className="flex flex-col gap-0.5 p-3">
        <span className="text-sm font-medium">{photo.caption}</span>
        <span className="text-xs text-muted-foreground">
          {photo.takenBy} · {formatDate(photo.takenAt)}
        </span>
      </figcaption>
    </figure>
  );
}
