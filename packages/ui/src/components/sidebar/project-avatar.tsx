"use client";

import { cn } from "@/lib/utils";
import type { Project, FaviconData } from "@/lib/projects-context";

const AVATAR_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-cyan-500",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getAvatarColor(name: string): string {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
}

interface ProjectAvatarProps {
  project: Project;
  favicon: FaviconData | null | undefined;
  size?: number;
  className?: string;
}

export function ProjectAvatar({
  project,
  favicon,
  size = 48,
  className,
}: ProjectAvatarProps) {
  const letter = (project.name[0] || "?").toUpperCase();
  const colorClass = getAvatarColor(project.name);

  if (favicon?.data) {
    return (
      <img
        src={`data:${favicon.mimeType};base64,${favicon.data}`}
        alt={project.name}
        draggable={false}
        className={cn("rounded-lg object-cover shrink-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 text-white font-bold select-none",
        colorClass,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {letter}
    </div>
  );
}
