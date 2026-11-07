import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { PhotoTile } from "@/components/portal/PhotoTile";
import { formatDate } from "@/lib/format";
import type { Inspection, Issue, SitePhoto } from "@/interfaces/portal-interface";

const PRIORITY = {
  High: "destructive",
  Medium: "warning",
  Low: "neutral",
} as const;

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

/** Photos / inspections / issues for a single project. */
export function SiteEvidenceTabs({
  photos,
  inspections,
  issues,
}: {
  photos: SitePhoto[];
  inspections: Inspection[];
  issues: Issue[];
}) {
  const photosTab =
    photos.length === 0 ? (
      <EmptyState message="No site photos yet." />
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.map((p) => (
          <PhotoTile key={p.id} photo={p} />
        ))}
      </div>
    );

  const inspectionsTab =
    inspections.length === 0 ? (
      <EmptyState message="No inspections recorded yet." />
    ) : (
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inspection</TableHead>
                <TableHead>Inspector</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspections.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.title}</TableCell>
                  <TableCell>{i.inspector}</TableCell>
                  <TableCell>{formatDate(i.date)}</TableCell>
                  <TableCell>
                    <StatusBadge status={i.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );

  const issuesTab =
    issues.length === 0 ? (
      <EmptyState message="No issues raised." />
    ) : (
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.title}</TableCell>
                  <TableCell>
                    {i.raisedBy}, {formatDate(i.raisedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PRIORITY[i.priority]}>{i.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={i.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );

  return (
    <Tabs
      tabs={[
        {
          value: "photos",
          label: `Photos (${photos.length})`,
          content: photosTab,
        },
        {
          value: "inspections",
          label: `Inspections (${inspections.length})`,
          content: inspectionsTab,
        },
        {
          value: "issues",
          label: `Issues (${issues.length})`,
          content: issuesTab,
        },
      ]}
    />
  );
}
