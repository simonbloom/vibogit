import { cn } from "@/lib/utils";
import { Check, Circle, ArrowUp, ArrowDown } from "lucide-react";

interface GitStatusBadgeProps {
  uncommittedCount: number;
  ahead: number;
  behind: number;
  isClean: boolean;
  className?: string;
}

export function GitStatusBadge({ 
  uncommittedCount, 
  ahead, 
  behind, 
  isClean,
  className 
}: GitStatusBadgeProps) {
  if (isClean) {
    return (
      <span className={cn("text-green-500", className)} title="All clean">
        <Check className="h-3 w-3" />
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 text-xs", className)}>
      {uncommittedCount > 0 && (
        <span 
          className="flex items-center text-amber-500" 
          title={`${uncommittedCount} uncommitted change${uncommittedCount > 1 ? "s" : ""}`}
        >
          <Circle className="h-2 w-2 fill-current" />
          <span className="ml-0.5">{uncommittedCount}</span>
        </span>
      )}
      {ahead > 0 && (
        <span 
          className="flex items-center text-blue-500" 
          title={`${ahead} commit${ahead > 1 ? "s" : ""} ahead`}
        >
          <ArrowUp className="h-3 w-3" />
          <span>{ahead}</span>
        </span>
      )}
      {behind > 0 && (
        <span 
          className="flex items-center text-yellow-500" 
          title={`${behind} commit${behind > 1 ? "s" : ""} behind`}
        >
          <ArrowDown className="h-3 w-3" />
          <span>{behind}</span>
        </span>
      )}
    </div>
  );
}
