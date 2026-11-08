import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteEvidenceTabs } from "@/components/portal/evidence/SiteEvidenceTabs";
import { mockInspections, mockIssues, mockPhotos } from "@/mocks/evidence";

export function SiteEvidenceTab({ projectId }: { projectId: number }) {
  const forProject = <T extends { projectId: number }>(items: T[]) =>
    items.filter((item) => item.projectId === projectId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button>
          <Upload /> Capture
        </Button>
      </div>
      <SiteEvidenceTabs
        photos={forProject(mockPhotos)}
        inspections={forProject(mockInspections)}
        issues={forProject(mockIssues)}
      />
    </div>
  );
}
