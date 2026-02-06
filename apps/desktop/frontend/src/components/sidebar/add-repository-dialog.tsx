"use client";

import { useState } from "react";
import { useProjects } from "@/lib/projects-context";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Folder, Loader2 } from "lucide-react";

async function openTauriFolderPicker(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    if (typeof open !== "function") return null;
    const result = await open({ directory: true, multiple: false, title: "Select a Project Folder" });
    return typeof result === "string" ? result : null;
  } catch {
    return null;
  }
}

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRepositoryDialog({ isOpen, onClose }: AddProjectDialogProps) {
  const { addProject } = useProjects();
  const { send } = useDaemon();
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleBrowse = async () => {
    // Try Tauri native dialog first
    const tauriResult = await openTauriFolderPicker();
    if (tauriResult) {
      setPath(tauriResult);
      setError(null);
      return;
    }
    // Fallback: use daemon's pickFolder (AppleScript native folder picker)
    try {
      const response = await send<{ path: string | null }>("pickFolder");
      if (response.path) {
        setPath(response.path);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to open folder picker:", err);
    }
  };

  const handleSubmit = async () => {
    if (!path) {
      setError("Please enter a project path");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await addProject(path);
      setPath("");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add project";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPath("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
          <DialogDescription>
            Choose a folder containing a git project to add to your sidebar.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                setError(null);
              }}
              placeholder="/path/to/project"
              className="flex-1"
            />
            <Button 
              variant="outline" 
              onClick={handleBrowse}
              type="button"
            >
              <Folder className="h-4 w-4 mr-2" />
              Browse
            </Button>
          </div>
          
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!path || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Project"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
