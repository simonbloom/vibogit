"use client";

import { Badge } from "@vibogit/ui/components/ui/badge";
import { Button } from "@vibogit/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vibogit/ui/components/ui/card";
import { Input } from "@vibogit/ui/components/ui/input";
import { Textarea } from "@vibogit/ui/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@vibogit/ui/components/ui/toggle-group";
import { BranchSelector } from "@vibogit/ui/components/branch-selector";
import { CodeViewer } from "@vibogit/ui/components/code-viewer";
import { CommitHistory } from "@vibogit/ui/components/commit-history";
import { DevServerConnection } from "@vibogit/ui/components/dev-server-connection";
import { FileTree } from "@vibogit/ui/components/file-tree";
import { MiniView } from "@vibogit/ui/components/mini-view";
import { PromptBox } from "@vibogit/ui/components/prompt-box";
import { SettingsTabs } from "@vibogit/ui/components/settings/SettingsTabs";
import { ThemeToggle } from "@vibogit/ui/components/settings/ThemeToggle";
import { Sidebar } from "@vibogit/ui/components/sidebar/sidebar";
import { ProjectList } from "@vibogit/ui/components/sidebar/project-list";
import { GitStatusBadge } from "@vibogit/ui/components/sidebar/git-status-badge";
import { StagedChanges } from "@vibogit/ui/components/staged-changes";
import { UpdateBanner } from "@vibogit/ui/components/update-banner";
import { CaptureCard, DesktopPreview, FigmaPageHeader, FigmaSection, MiniPreview } from "./capture-shell";
import { FigmaMockProviders } from "./mock-providers";
import { MOCK_BRANCHES, MOCK_PROJECTS, MOCK_REPO_PATH, MOCK_UPDATE_STATE, createReadyDaemonState } from "./mock-data";

function FoundationGrid() {
  return (
    <div className="grid min-w-[760px] grid-cols-2 gap-5 rounded-[28px] border border-slate-300 bg-white p-6 shadow-sm">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <Input value="https://github.com/simonbloom/vibogit" readOnly />
        <Textarea value="Ask about this project... use @ for files and / for skills." readOnly rows={4} />
        <div className="flex flex-wrap gap-2">
          <Badge>Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Example Card</CardTitle>
          <CardDescription>Foundation tokens applied through the shared UI package.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleGroup type="single" value="changes">
            <ToggleGroupItem value="changes">Changes</ToggleGroupItem>
            <ToggleGroupItem value="tree">Tree</ToggleGroupItem>
            <ToggleGroupItem value="graph">Graph</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex gap-2">
            <Button size="sm">Commit</Button>
            <Button size="sm" variant="outline">
              Open Repo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SidebarShowcase({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-300 bg-background shadow-sm" style={{ height: 560 }}>
      <FigmaMockProviders daemonState={createReadyDaemonState()} selectedProjectPath={MOCK_REPO_PATH}>
        <Sidebar initialCollapsed={collapsed}>
          {(isCollapsed) => <ProjectList isCollapsed={isCollapsed} />}
        </Sidebar>
      </FigmaMockProviders>
    </div>
  );
}

function ShellComponentPreview({ children, width = 420, height = 120 }: { children: React.ReactNode; width?: number; height?: number }) {
  return (
    <div
      className="overflow-hidden rounded-[24px] border border-slate-300 bg-white shadow-sm"
      style={{ width, height }}
    >
      <div className="flex h-full w-full items-center justify-center bg-background p-4">{children}</div>
    </div>
  );
}

export function ComponentsCapturePage() {
  const readyState = createReadyDaemonState();

  return (
    <>
      <FigmaPageHeader
        eyebrow="Page 2"
        title="Components"
        description="Reusable primitives and repeated app modules captured in isolation from the same code that powers the desktop UI."
      />

      <FigmaSection title="Foundations" description="Core primitives reused across the app shell and modal surfaces.">
        <CaptureCard label="Buttons, Inputs, Cards, Toggle Group" meta="760 px">
          <FoundationGrid />
        </CaptureCard>
      </FigmaSection>

      <FigmaSection title="App Shell" description="Sidebar, project list states, and shell-level controls.">
        <CaptureCard label="Sidebar / Expanded" meta="220 × 560">
          <SidebarShowcase collapsed={false} />
        </CaptureCard>

        <CaptureCard label="Sidebar / Collapsed" meta="64 × 560">
          <SidebarShowcase collapsed />
        </CaptureCard>

        <CaptureCard label="Git Status Badge" meta="220 × 120">
          <ShellComponentPreview width={220} height={120}>
            <div className="flex flex-col gap-4">
              <GitStatusBadge uncommittedCount={4} ahead={2} behind={1} isClean={false} />
              <GitStatusBadge uncommittedCount={0} ahead={0} behind={0} isClean />
            </div>
          </ShellComponentPreview>
        </CaptureCard>

        <CaptureCard label="Settings Tabs" meta="720 × 96">
          <ShellComponentPreview width={720} height={96}>
            <SettingsTabs activeTab="appearance" onTabChange={() => {}} />
          </ShellComponentPreview>
        </CaptureCard>

        <CaptureCard label="Theme Toggle" meta="620 × 150">
          <ShellComponentPreview width={620} height={150}>
            <ThemeToggle />
          </ShellComponentPreview>
        </CaptureCard>
      </FigmaSection>

      <FigmaSection title="Workflow Modules" description="Small interactive modules used inside the main desktop workflow.">
        <CaptureCard label="Branch Selector" meta="260 × 72">
          <ShellComponentPreview width={260} height={72}>
            <FigmaMockProviders daemonState={readyState}>
              <BranchSelector currentBranch={MOCK_BRANCHES.find((branch) => branch.current)} branches={MOCK_BRANCHES} />
            </FigmaMockProviders>
          </ShellComponentPreview>
        </CaptureCard>

        <CaptureCard label="Dev Server Connection" meta="340 × 72">
          <ShellComponentPreview width={340} height={72}>
            <FigmaMockProviders daemonState={readyState}>
              <DevServerConnection repoPath={MOCK_REPO_PATH} />
            </FigmaMockProviders>
          </ShellComponentPreview>
        </CaptureCard>

        <CaptureCard label="Prompt Box" meta="760 × 320">
          <div className="overflow-hidden rounded-[28px] border border-slate-300 bg-white p-5 shadow-sm" style={{ width: 760 }}>
            <FigmaMockProviders daemonState={readyState}>
              <PromptBox
                defaultValue="Use /figma to capture the current app states and include @packages/ui/src/components/main-interface.tsx."
                projectFiles={[
                  "packages/ui/src/components/main-interface.tsx",
                  "packages/ui/src/components/settings-panel.tsx",
                  "apps/desktop/frontend/src/app/figma-capture/screens/page.tsx",
                ]}
                imageBasePath="/Users/simonbloom/Pictures/Screenshots/"
                terminalName="Ghostty"
                onSubmit={() => {}}
              />
            </FigmaMockProviders>
          </div>
        </CaptureCard>

        <CaptureCard label="Update Banner" meta="760 × 80">
          <div className="overflow-hidden rounded-[28px] border border-slate-300 bg-white p-4 shadow-sm" style={{ width: 760 }}>
            <UpdateBanner {...MOCK_UPDATE_STATE} />
          </div>
        </CaptureCard>

        <CaptureCard label="Mini View" meta="680 × 56">
          <MiniPreview>
            <FigmaMockProviders daemonState={readyState}>
              <MiniView />
            </FigmaMockProviders>
          </MiniPreview>
        </CaptureCard>
      </FigmaSection>

      <FigmaSection title="Content Modules" description="Larger content regions rendered with mocked repo state and file data.">
        <CaptureCard label="Staged Changes" meta="900 × 560">
          <DesktopPreview width={900} height={560}>
            <FigmaMockProviders daemonState={readyState}>
              <StagedChanges repoPath={MOCK_REPO_PATH} />
            </FigmaMockProviders>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="File Tree" meta="360 × 460">
          <DesktopPreview width={360} height={460}>
            <FigmaMockProviders daemonState={readyState}>
              <FileTree repoPath={MOCK_REPO_PATH} selectedPath="packages/ui/src/components/main-interface.tsx" />
            </FigmaMockProviders>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Code Viewer" meta="720 × 460">
          <DesktopPreview width={720} height={460}>
            <FigmaMockProviders daemonState={readyState}>
              <CodeViewer
                repoPath={MOCK_REPO_PATH}
                filePath="packages/ui/src/components/main-interface.tsx"
                fileName="main-interface.tsx"
              />
            </FigmaMockProviders>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Commit Graph" meta="900 × 520">
          <DesktopPreview width={900} height={520}>
            <FigmaMockProviders daemonState={readyState}>
              <CommitHistory repoPath={MOCK_REPO_PATH} />
            </FigmaMockProviders>
          </DesktopPreview>
        </CaptureCard>
      </FigmaSection>
    </>
  );
}
