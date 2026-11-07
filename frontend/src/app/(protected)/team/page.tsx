import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/portal/PageHeader";
import { MockBanner } from "@/components/portal/MockBanner";
import { mockTeam } from "@/mocks/team";
import { getMockProject } from "@/mocks/projects";

const ROLE_VARIANT = {
  Admin: "solid",
  Manager: "default",
  Field: "neutral",
} as const;

export default function TeamPage() {
  return (
    <>
      <PageHeader
        title="Team"
        description="Company roles, project membership and access."
        actions={
          <Button>
            <UserPlus /> Invite member
          </Button>
        }
      />
      <MockBanner />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTeam.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                        {t.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[t.role]}>{t.role}</Badge>
                  </TableCell>
                  <TableCell>{t.trade}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.projectIds.map((id) => (
                        <Badge key={id} variant="outline">
                          {getMockProject(id)?.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.phone}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
