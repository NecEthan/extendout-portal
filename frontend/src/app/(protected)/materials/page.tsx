import { Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/portal/PageHeader";
import { MockBanner } from "@/components/portal/MockBanner";
import { materialColumns, mockMaterials } from "@/mocks/materials";
import { getMockProject } from "@/mocks/projects";
import { formatDate, formatGBP } from "@/lib/format";

export default function MaterialsPage() {
  return (
    <>
      <PageHeader
        title="Materials"
        description="From requirement to RFQ, order and delivery to site."
        actions={
          <Button>
            <Plus /> Add requirement
          </Button>
        }
      />
      <MockBanner />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {materialColumns.map((col) => {
          const items = mockMaterials.filter((m) => m.status === col);
          return (
            <section
              key={col}
              className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-3"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{col}</h2>
                <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">
                  {items.length}
                </span>
              </div>
              {items.map((m) => (
                <Card key={m.id} size="sm" className="gap-1.5 px-3">
                  <span className="text-sm font-medium">{m.item}</span>
                  <span className="text-xs text-primary">
                    {getMockProject(m.projectId)?.name}
                  </span>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{m.quantity}</span>
                    <span>Need by {formatDate(m.needBy)}</span>
                  </div>
                  {(m.supplier || m.cost) && (
                    <div className="flex items-center justify-between border-t pt-1.5 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Truck size={12} /> {m.supplier}
                      </span>
                      {m.cost && (
                        <span className="font-medium">{formatGBP(m.cost)}</span>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
