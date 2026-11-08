import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { applicationRoutes } from "@/utils/applicationRoutes";

export function BackLink() {
  return (
    <Link
      href={applicationRoutes.projects}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
    >
      <ArrowLeft size={14} /> All projects
    </Link>
  );
}
