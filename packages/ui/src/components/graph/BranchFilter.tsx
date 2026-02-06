"use client";

import { memo, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, Eye, EyeOff } from "lucide-react";
import { getBranchColorBase } from "./utils/colors";

export interface Branch {
  name: string;
  isRemote: boolean;
  colorIndex: number;
}

export interface BranchFilterProps {
  branches: Branch[];
  visibleBranches: Set<string>;
  onToggleBranch: (branchName: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export const BranchFilter = memo(function BranchFilter({
  branches,
  visibleBranches,
  onToggleBranch,
  onShowAll,
  onHideAll,
}: BranchFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const localBranches = useMemo(
    () => branches.filter((b) => !b.isRemote),
    [branches]
  );
  const remoteBranches = useMemo(
    () => branches.filter((b) => b.isRemote),
    [branches]
  );

  const visibleCount = visibleBranches.size;
  const totalCount = branches.length;

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <Eye className="w-4 h-4 text-muted-foreground" />
        <span>
          Branches ({visibleCount}/{totalCount})
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl min-w-[280px] max-h-[400px] overflow-hidden animate-in fade-in-0 zoom-in-95">
            {/* Header actions */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <span className="text-sm font-medium text-muted-foreground">
                Filter Branches
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onShowAll}>
                  All
                </Button>
                <Button variant="ghost" size="sm" onClick={onHideAll}>
                  None
                </Button>
              </div>
            </div>

            {/* Branch list */}
            <div className="overflow-y-auto max-h-[340px]">
              {/* Local branches */}
              {localBranches.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20">
                    Local
                  </div>
                  {localBranches.map((branch) => (
                    <BranchItem
                      key={branch.name}
                      branch={branch}
                      isVisible={visibleBranches.has(branch.name)}
                      onToggle={() => onToggleBranch(branch.name)}
                    />
                  ))}
                </div>
              )}

              {/* Remote branches */}
              {remoteBranches.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20">
                    Remote
                  </div>
                  {remoteBranches.map((branch) => (
                    <BranchItem
                      key={branch.name}
                      branch={branch}
                      isVisible={visibleBranches.has(branch.name)}
                      onToggle={() => onToggleBranch(branch.name)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

interface BranchItemProps {
  branch: Branch;
  isVisible: boolean;
  onToggle: () => void;
}

function BranchItem({ branch, isVisible, onToggle }: BranchItemProps) {
  const color = getBranchColorBase(branch.colorIndex);

  return (
    <Button
      variant="ghost"
      onClick={onToggle}
      className="w-full flex items-center justify-start gap-3 px-4 py-2.5 h-auto rounded-none"
    >
      <div
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span
        className={`flex-1 text-base truncate text-left ${
          isVisible ? "text-foreground" : "text-muted-foreground line-through"
        }`}
      >
        {branch.name}
      </span>
      {isVisible ? (
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : (
        <EyeOff className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      )}
    </Button>
  );
}
