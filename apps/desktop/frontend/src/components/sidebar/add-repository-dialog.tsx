"use client";

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjects } from "@/lib/projects-context";
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

interface AddRepositoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRepositoryDialog({ isOpen, onClose }: AddRepositoryDialogProps) {
  const { addProject } = useProjects();
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select a Git Repository",
      });
      
      if (selected && typeof selected === "string") {
        setPath(selected);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to open folder picker:", err);
    }
  };

  const handleSubmit = async () => {
    if (!path) {
      setError("Please select a folder");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await addProject(path);
      setPath("");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add repository";
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
          <DialogTitle>Add Repository</DialogTitle>
          <DialogDescription>
            Choose a folder containing a git repository to add to your projects.
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
              placeholder="/path/to/repository"
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
              "Add Repository"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
