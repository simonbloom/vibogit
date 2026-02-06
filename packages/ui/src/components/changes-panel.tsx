"use client";

import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import { File, Plus, Minus, Edit3, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import type { GitStatus, GitFile } from "@vibogit/shared";
import { useState } from "react";

interface ChangesPanelProps {
  status: GitStatus | null;
  selectedFile: GitFile | null;
  onSelectFile: (file: GitFile | null) => void;
}

export function ChangesPanel({ status, selectedFile, onSelectFile }: ChangesPanelProps) {
  const { send, refreshStatus, state } = useDaemon();
  const [expandedSections, setExpandedSections] = useState({
    staged: true,
    unstaged: true,
    untracked: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleStageFile = async (file: GitFile) => {
    if (!state.repoPath) return;
    await send("stage", { repoPath: state.repoPath, files: [file.path] });
    await refreshStatus();
  };

  const handleUnstageFile = async (file: GitFile) => {
    if (!state.repoPath) return;
    await send("unstage", { repoPath: state.repoPath, files: [file.path] });
    await refreshStatus();
  };

  const handleStageAll = async () => {
    if (!state.repoPath || !status) return;
    const files = [
      ...status.unstaged.map((f) => f.path),
      ...status.untracked.map((f) => f.path),
    ];
    if (files.length > 0) {
      await send("stage", { repoPath: state.repoPath, files });
      await refreshStatus();
    }
  };

  const handleUnstageAll = async () => {
    if (!state.repoPath || !status) return;
    const files = status.staged.map((f) => f.path);
    if (files.length > 0) {
      await send("unstage", { repoPath: state.repoPath, files });
      await refreshStatus();
    }
  };

  const totalChanges =
    (status?.staged.length || 0) +
    (status?.unstaged.length || 0) +
    (status?.untracked.length || 0);

  if (!status) {
    return (
      <div className="p-4 text-center text-text-muted">
        Loading changes...
      </div>
    );
  }

  if (totalChanges === 0) {
    return (
      <div className="p-4 text-center text-text-muted">
        <p className="mb-2">No changes</p>
        <p className="text-sm">Your working directory is clean</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">
          Changes ({totalChanges})
        </span>
        {(status.unstaged.length > 0 || status.untracked.length > 0) && (
          <Button variant="link" size="sm" className="h-auto p-0" onClick={handleStageAll}>
            Stage all
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Staged Changes */}
        {status.staged.length > 0 && (
          <FileSection
            title="Staged"
            count={status.staged.length}
            files={status.staged}
            expanded={expandedSections.staged}
            onToggle={() => toggleSection("staged")}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            actionLabel="Unstage"
            onAction={handleUnstageFile}
            onActionAll={handleUnstageAll}
          />
        )}

        {/* Unstaged Changes */}
        {status.unstaged.length > 0 && (
          <FileSection
            title="Modified"
            count={status.unstaged.length}
            files={status.unstaged}
            expanded={expandedSections.unstaged}
            onToggle={() => toggleSection("unstaged")}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            actionLabel="Stage"
            onAction={handleStageFile}
          />
        )}

        {/* Untracked Files */}
        {status.untracked.length > 0 && (
          <FileSection
            title="Untracked"
            count={status.untracked.length}
            files={status.untracked}
            expanded={expandedSections.untracked}
            onToggle={() => toggleSection("untracked")}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            actionLabel="Stage"
            onAction={handleStageFile}
          />
        )}
      </div>
    </div>
  );
}

interface FileSectionProps {
  title: string;
  count: number;
  files: GitFile[];
  expanded: boolean;
  onToggle: () => void;
  selectedFile: GitFile | null;
  onSelectFile: (file: GitFile | null) => void;
  actionLabel: string;
  onAction: (file: GitFile) => void;
  onActionAll?: () => void;
}

function FileSection({
  title,
  count,
  files,
  expanded,
  onToggle,
  selectedFile,
  onSelectFile,
  actionLabel,
  onAction,
  onActionAll,
}: FileSectionProps) {
  return (
    <div className="border-b border-border">
      <Button
        variant="ghost"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 h-auto rounded-none"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
          <span className="text-sm font-medium text-text-secondary">{title}</span>
          <span className="text-xs text-text-muted">({count})</span>
        </div>
        {onActionAll && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={(e) => {
              e.stopPropagation();
              onActionAll();
            }}
          >
            {actionLabel} all
          </Button>
        )}
      </Button>

      {expanded && (
        <div className="pb-2">
          {files.map((file) => (
            <FileItem
              key={file.path}
              file={file}
              isSelected={selectedFile?.path === file.path}
              onSelect={() => onSelectFile(file)}
              actionLabel={actionLabel}
              onAction={() => onAction(file)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileItemProps {
  file: GitFile;
  isSelected: boolean;
  onSelect: () => void;
  actionLabel: string;
  onAction: () => void;
}

function FileItem({ file, isSelected, onSelect, actionLabel, onAction }: FileItemProps) {
  const statusConfig = {
    modified: { icon: Edit3, color: "text-status-modified", bg: "bg-status-modified/20" },
    added: { icon: Plus, color: "text-status-added", bg: "bg-status-added/20" },
    deleted: { icon: Minus, color: "text-status-deleted", bg: "bg-status-deleted/20" },
    untracked: { icon: HelpCircle, color: "text-status-untracked", bg: "bg-status-untracked/20" },
    renamed: { icon: File, color: "text-status-modified", bg: "bg-status-modified/20" },
    copied: { icon: File, color: "text-status-added", bg: "bg-status-added/20" },
  };

  const config = statusConfig[file.status];
  const Icon = config.icon;
  const fileName = file.path.split("/").pop() || file.path;
  const filePath = file.path.split("/").slice(0, -1).join("/");

  return (
    <div
      className={clsx(
        "group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors",
        isSelected ? "bg-accent/10" : "hover:bg-surface-light"
      )}
      onClick={onSelect}
    >
      <div className={clsx("p-1 rounded", config.bg)}>
        <Icon className={clsx("w-3 h-3", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{fileName}</p>
        {filePath && (
          <p className="text-xs text-text-muted truncate">{filePath}</p>
        )}
      </div>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
