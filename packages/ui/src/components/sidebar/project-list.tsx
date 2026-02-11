"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProjects } from "@/lib/projects-context";
import { ProjectItem } from "./project-item";
import { cn } from "@/lib/utils";
import type { FaviconData, Project, ProjectStatus } from "@/lib/projects-context";

interface ProjectListProps {
  isCollapsed?: boolean;
  onProjectSelect?: (path: string) => void;
}

type DropPosition = "before" | "after";

interface SortableProjectRowProps {
  project: Project;
  status?: ProjectStatus;
  favicon?: FaviconData | null;
  isSelected: boolean;
  isCollapsed?: boolean;
  isDragEnabled: boolean;
  dropPosition?: DropPosition | null;
  isDragActive: boolean;
  onClick: () => void;
  onRemove: () => void;
}

function SortableProjectRow({
  project,
  status,
  favicon,
  isSelected,
  isCollapsed,
  isDragEnabled,
  dropPosition,
  isDragActive,
  onClick,
  onRemove,
}: SortableProjectRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.path,
    disabled: !isDragEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-md",
        isDragEnabled && "cursor-grab active:cursor-grabbing",
        isDragging && "z-10 scale-[1.01] opacity-70",
        isDragActive && !isDragging && "transition-colors"
      )}
      {...attributes}
      {...listeners}
    >
      {dropPosition === "before" && (
        <div className="pointer-events-none absolute left-2 right-2 top-0 h-0.5 rounded-full bg-primary" />
      )}
      {dropPosition === "after" && (
        <div className="pointer-events-none absolute left-2 right-2 bottom-0 h-0.5 rounded-full bg-primary" />
      )}

      <ProjectItem
        project={project}
        status={status}
        favicon={favicon}
        isSelected={isSelected}
        isCollapsed={isCollapsed}
        onClick={onClick}
        onRemove={onRemove}
      />
    </div>
  );
}

export function ProjectList({ isCollapsed, onProjectSelect }: ProjectListProps) {
  const { state, selectProject, removeProject, reorderProjects } = useProjects();
  const { projects, selectedPath, statuses, favicons } = state;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const suppressClickUntilRef = useRef(0);
  const isDragEnabled = !isCollapsed;
  const projectPaths = useMemo(() => projects.map(project => project.path), [projects]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeIndex = activeId ? projectPaths.indexOf(activeId) : -1;
  const overIndex = overId ? projectPaths.indexOf(overId) : -1;
  const activeProject = activeId ? projects.find(project => project.path === activeId) : null;

  const clearDragState = () => {
    setActiveId(null);
    setOverId(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!isDragEnabled) return;
    const nextActiveId = String(event.active.id);
    setActiveId(nextActiveId);
    setOverId(nextActiveId);
    suppressClickUntilRef.current = Date.now() + 250;
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!isDragEnabled) return;
    setOverId(event.over ? String(event.over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isDragEnabled) return;

    const fromId = String(event.active.id);
    const toId = event.over ? String(event.over.id) : null;

    suppressClickUntilRef.current = Date.now() + 250;

    if (!toId || fromId === toId) {
      clearDragState();
      return;
    }

    const fromIndex = projectPaths.indexOf(fromId);
    const toIndex = projectPaths.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1) {
      clearDragState();
      return;
    }

    const reorderedPaths = arrayMove(projectPaths, fromIndex, toIndex);
    void reorderProjects(reorderedPaths);
    clearDragState();
  };

  const handleSelect = (path: string) => {
    if (Date.now() < suppressClickUntilRef.current) return;
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
    <DndContext
      sensors={isDragEnabled ? sensors : undefined}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <SortableContext items={projectPaths} strategy={verticalListSortingStrategy}>
        <div className="space-y-1 p-1">
          {projects.map((project) => {
            let dropPosition: DropPosition | null = null;
            if (
              isDragEnabled &&
              activeId &&
              overId &&
              activeId !== overId &&
              overId === project.path &&
              activeIndex !== -1 &&
              overIndex !== -1
            ) {
              dropPosition = activeIndex < overIndex ? "after" : "before";
            }

            return (
              <SortableProjectRow
                key={project.path}
                project={project}
                status={statuses[project.path]}
                favicon={favicons[project.path]}
                isSelected={project.path === selectedPath}
                isCollapsed={isCollapsed}
                isDragEnabled={isDragEnabled}
                dropPosition={dropPosition}
                isDragActive={activeId !== null}
                onClick={() => handleSelect(project.path)}
                onRemove={() => handleRemove(project.path)}
              />
            );
          })}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeProject ? (
          <div className="w-full rounded-md opacity-95 shadow-lg">
            <ProjectItem
              project={activeProject}
              status={statuses[activeProject.path]}
              favicon={favicons[activeProject.path]}
              isSelected={activeProject.path === selectedPath}
              isCollapsed={isCollapsed}
              onClick={() => {}}
              onRemove={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
