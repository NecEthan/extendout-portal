import type { Project } from "@/interfaces";
import { EditProjectForm } from "../../edit/EditProjectForm";
import { DeleteProject } from "./DeleteProject";

/** Admin only: edit the project's details, or delete it. */
export function SettingsTab({ project }: { project: Project }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Details</h2>
        <EditProjectForm project={project} />
      </section>
      <DeleteProject project={project} />
    </div>
  );
}
