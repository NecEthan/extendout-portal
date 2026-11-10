import { PageHeader } from "@/components/portal/PageHeader";
import { PhotoTile } from "@/components/portal/PhotoTile";
import { mockProgressUpdates } from "@/mocks/client";
import { formatDate } from "@/lib/format";

export default function ProgressPhotosPage() {
  return (
    <>
      <PageHeader title="Progress Photos" />
      <ol className="flex flex-col gap-8 border-l-2 border-primary/30 pl-6">
        {mockProgressUpdates.map((u) => (
          <li key={u.id} className="relative flex flex-col gap-3">
            <span className="absolute top-1 -left-[33px] size-4 rounded-full border-4 border-background bg-primary" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium tracking-wide text-primary uppercase">
                {formatDate(u.date)}
              </span>
              <h2 className="text-lg font-semibold">{u.title}</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {u.summary}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {u.photos.map((p) => (
                <PhotoTile key={p.id} photo={p} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
