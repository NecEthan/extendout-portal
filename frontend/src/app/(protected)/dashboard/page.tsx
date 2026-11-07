import Link from "next/link";
import { FolderKanban, PoundSterling } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { MockBanner } from "@/components/portal/MockBanner";
import { ProjectCard } from "@/components/portal/projects/ProjectCard";
import { mockProjects } from "@/mocks/projects";
import { mockActivity } from "@/mocks/dashboard";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { formatGBP } from "@/lib/format";

export default function DashboardPage() {
  const active = mockProjects.filter((p) => p.health !== "Complete");
  const valueOnSite = active.reduce((sum, p) => sum + p.budget, 0);

  return (
    <>
      <PageHeader
        title="Good morning"
        description="Here's what's happening across your ExtendOut projects today."
      />
      <MockBanner />

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Active projects"
          value={String(active.length)}
          hint={`${mockProjects.length} total`}
          icon={FolderKanban}
        />
        <StatCard
          label="Value on site"
          value={formatGBP(valueOnSite)}
          hint="Contract value, active jobs"
          icon={PoundSterling}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <section className="flex flex-col gap-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active projects</h2>
            <Link
              href={applicationRoutes.projects}
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-4 border-l pl-4">
                {mockActivity.map((a) => (
                  <li key={a.id} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary" />
                    <span className="font-medium">{a.who}</span> {a.action}{" "}
                    <span className="font-medium">{a.target}</span>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.at).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
