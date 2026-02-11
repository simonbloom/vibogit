"use client";

import { useProjects } from "@/lib/projects-context";
import { ProjectItem } from "./project-item";

interface ProjectListProps {
  isCollapsed?: boolean;
  onProjectSelect?: (path: string) => void;
}

export function ProjectList({ isCollapsed, onProjectSelect }: ProjectListProps) {
  const { state, selectProject, removeProject } = useProjects();
  const { projects, selectedPath, statuses, favicons } = state;

  const handleSelect = (path: string) => {
    selectProject(path);
    onProjectSelect?.(path);
  };

  const handleRemove = async (path: string) => {
    await removeProject(path);
    // If we removed the selected project, select the first remaining one
    if (path === selectedPath && projects.length > 1) {
      const remaining = projects.find(p => p.path !== path);
      if (remaining) {
        selectProject(remaining.path);
        onProjectSelect?.(remaining.path);
      }
    }
  };

  if (projects.length === 0) {
    return (
      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
        {isCollapsed ? null : "No projects yet"}
      </div>
    );
  }

  return (
    <div className="space-y-1 p-1">
      {projects.map((project) => (
        <ProjectItem
          key={project.path}
          project={project}
          status={statuses[project.path]}
          favicon={favicons[project.path]}
          isSelected={project.path === selectedPath}
          isCollapsed={isCollapsed}
          onClick={() => handleSelect(project.path)}
          onRemove={() => handleRemove(project.path)}
        />
      ))}
    </div>
  );
}
