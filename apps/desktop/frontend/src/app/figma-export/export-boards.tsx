"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_CONFIG, type Config, type GitBranch, type GitFile, type GitStatus } from "@vibogit/shared";
import { AppLayout } from "@vibogit/ui/components/app-layout";
import { MainInterface } from "@vibogit/ui/components/main-interface";
import { MiniView } from "@vibogit/ui/components/mini-view";
import { OnboardingScreen } from "@vibogit/ui/components/onboarding-screen";
import { WelcomeScreen } from "@vibogit/ui/components/welcome-screen";
import { TabBar } from "@vibogit/ui/components/tab-bar";
import { BranchSelector } from "@vibogit/ui/components/branch-selector";
import { ChangesDrawer } from "@vibogit/ui/components/changes-drawer";
import { ChangesPanel } from "@vibogit/ui/components/changes-panel";
import { CodeViewer } from "@vibogit/ui/components/code-viewer";
import { CommitHistory } from "@vibogit/ui/components/commit-history";
import { CreatePRDialog } from "@vibogit/ui/components/create-pr-dialog";
import { DevServerPanel } from "@vibogit/ui/components/dev-server-panel";
import { FileTree } from "@vibogit/ui/components/file-tree";
import { PromptBox } from "@vibogit/ui/components/prompt-box";
import { StagedChanges } from "@vibogit/ui/components/staged-changes";
import { UpdateBanner } from "@vibogit/ui/components/update-banner";
import { ProjectItem } from "@vibogit/ui/components/sidebar/project-item";
import { AISettingsSection } from "@vibogit/ui/components/settings/sections/AISettingsSection";
import { AppSettingsSection } from "@vibogit/ui/components/settings/sections/AppSettingsSection";
import { AppearanceSettingsSection } from "@vibogit/ui/components/settings/sections/AppearanceSettingsSection";
import { CaptureSettingsSection } from "@vibogit/ui/components/settings/sections/CaptureSettingsSection";
import { ToolsSettingsSection } from "@vibogit/ui/components/settings/sections/ToolsSettingsSection";
import { useConfig } from "@vibogit/ui/lib/config-context";
import { useDaemon } from "@vibogit/ui/lib/daemon-context";
import type { Project, ProjectStatus } from "@vibogit/ui/lib/projects-context";
import { useProjects } from "@vibogit/ui/lib/projects-context";
import { useTabs } from "@vibogit/ui/lib/tabs-context";
import type { AutoUpdateActions, AutoUpdateState } from "@vibogit/ui/lib/use-auto-update";

const EXPORT_REPO_PATH = "/Users/simonbloom/apps-vol11/vibogit";
const SAMPLE_PROJECT_PATHS = [
  EXPORT_REPO_PATH,
  "/Users/simonbloom/apps-vol11/bloomindesign",
  "/Users/simonbloom/apps-vol11/agent-browser",
];
const SAMPLE_PROJECT_ITEMS: Array<{ project: Project; status: ProjectStatus }> = [
  {
    project: { path: EXPORT_REPO_PATH, name: "vibogit", addedAt: Date.now() - 1000 },
    status: { path: EXPORT_REPO_PATH, currentBranch: "main", uncommittedCount: 5, ahead: 2, behind: 0, isClean: false },
  },
  {
    project: { path: SAMPLE_PROJECT_PATHS[1], name: "bloomindesign", addedAt: Date.now() - 2000 },
    status: { path: SAMPLE_PROJECT_PATHS[1], currentBranch: "release/homepage", uncommittedCount: 0, ahead: 0, behind: 1, isClean: false },
  },
  {
    project: { path: SAMPLE_PROJECT_PATHS[2], name: "agent-browser", addedAt: Date.now() - 3000 },
    status: { path: SAMPLE_PROJECT_PATHS[2], currentBranch: "feat/browser-tools", uncommittedCount: 0, ahead: 0, behind: 0, isClean: true },
  },
];
const SAMPLE_BRANCHES: GitBranch[] = [
  { name: "main", current: true, tracking: "origin/main", ahead: 2, behind: 0 },
  { name: "feat/figma-export", current: false, tracking: "origin/feat/figma-export", ahead: 0, behind: 0 },
  { name: "design/light-mode", current: false, tracking: "origin/design/light-mode", ahead: 0, behind: 1 },
];
const SAMPLE_STATUS: GitStatus = {
  branch: "main",
  ahead: 2,
  behind: 0,
  staged: [
    { path: "packages/ui/src/components/sidebar/sidebar.tsx", status: "modified", staged: true },
    { path: "packages/ui/src/components/main-interface.tsx", status: "modified", staged: true },
  ],
  unstaged: [
    { path: "apps/desktop/frontend/src/app/layout.tsx", status: "modified", staged: false },
    { path: "packages/ui/src/lib/daemon-context.tsx", status: "modified", staged: false },
  ],
  untracked: [
    { path: "apps/desktop/frontend/src/app/figma-export/export-boards.tsx", status: "untracked", staged: false },
  ],
  isEmptyRepo: false,
};
const SETTINGS_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  computerName: "Studio Mac",
  aiProvider: "openai",
  aiModel: "gpt-5.3-codex-spark",
  aiApiKey: "sk-**********************",
  githubPat: "ghp_************************",
  editor: "cursor",
  terminal: "Ghostty",
  theme: "light",
  imageBasePath: "~/Desktop/Captures",
  cleanShotMode: true,
  autoExecutePrompt: true,
};

type ExportTheme = "light" | "dark";

function getExportTheme(value: string | null | undefined): ExportTheme {
  return value === "dark" ? "dark" : "light";
}

function noopAsync() {
  return Promise.resolve();
}

const UPDATE_AVAILABLE: AutoUpdateState & AutoUpdateActions = {
  status: "update-available",
  version: "4.1.0",
  notes: null,
  progress: 0,
  error: null,
  checkForUpdate: noopAsync,
  startUpdate: noopAsync,
  restartApp: noopAsync,
  dismiss: () => {},
};

const DOWNLOADING_UPDATE: AutoUpdateState & AutoUpdateActions = {
  status: "downloading",
  version: "4.1.0",
  notes: null,
  progress: 67,
  error: null,
  checkForUpdate: noopAsync,
  startUpdate: noopAsync,
  restartApp: noopAsync,
  dismiss: () => {},
};

const READY_UPDATE: AutoUpdateState & AutoUpdateActions = {
  status: "ready",
  version: "4.1.0",
  notes: null,
  progress: 100,
  error: "Update installed. Restart to apply it.",
  checkForUpdate: noopAsync,
  startUpdate: noopAsync,
  restartApp: noopAsync,
  dismiss: () => {},
};

function Frame({
  title,
  description,
  theme,
  children,
  className = "",
}: {
  title: string;
  description: string;
  theme: ExportTheme;
  children: React.ReactNode;
  className?: string;
}) {
  const isDark = theme === "dark";

  return (
    <section className="space-y-3">
      <div>
        <h2 className={`text-lg font-semibold tracking-tight ${isDark ? "text-slate-50" : "text-slate-950"}`}>{title}</h2>
        <p className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>{description}</p>
      </div>
      <div
        className={`overflow-hidden border ${
          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        } ${className}`}
      >
        {children}
      </div>
    </section>
  );
}

function Panel({
  title,
  theme,
  children,
  className = "",
}: {
  title: string;
  theme: ExportTheme;
  children: React.ReactNode;
  className?: string;
}) {
  const isDark = theme === "dark";

  return (
    <section
      className={`overflow-hidden border ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      } ${className}`}
    >
      <div className={`border-b px-5 py-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
        <h3 className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ExportHeader({
  title,
  description,
  theme,
}: {
  title: string;
  description: string;
  theme: ExportTheme;
}) {
  const isDark = theme === "dark";
  const modeLabel = isDark ? "Dark" : "Light";

  return (
    <header
      className={`border px-6 py-5 ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      <p className={`text-xs font-medium uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Figma export board
      </p>
      <h1 className={`mt-2 text-2xl font-semibold tracking-tight ${isDark ? "text-slate-50" : "text-slate-950"}`}>
        {title}
      </h1>
      <p className={`mt-2 max-w-3xl text-sm leading-6 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
        {description}
      </p>
      <p className={`mt-3 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Theme: {modeLabel}
      </p>
    </header>
  );
}

function useExportBootstrap(exportTheme: ExportTheme) {
  const { state, setRepoPath } = useDaemon();
  const { addProject, selectProject } = useProjects();
  const { addTab } = useTabs();
  const { setConfig } = useConfig();
  const hasBootstrappedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (hasBootstrappedRef.current || state.connection !== "connected") return;

    hasBootstrappedRef.current = true;

    const setup = async () => {
      await setConfig({ ...SETTINGS_CONFIG, theme: exportTheme });
      for (const path of SAMPLE_PROJECT_PATHS) {
        await addProject(path);
      }

      addTab(EXPORT_REPO_PATH);
      addTab(SAMPLE_PROJECT_PATHS[1]);
      addTab(SAMPLE_PROJECT_PATHS[2]);
      selectProject(EXPORT_REPO_PATH);
      await setRepoPath(EXPORT_REPO_PATH);
      setReady(true);
    };

    void setup();
  }, [addProject, addTab, exportTheme, selectProject, setConfig, setRepoPath, state.connection]);

  return { ready, repoPath: EXPORT_REPO_PATH };
}

function SidebarProjectShowcase() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_140px]">
      <div className="space-y-2 border border-slate-200 bg-slate-50 p-3">
        {SAMPLE_PROJECT_ITEMS.map(({ project, status }, index) => (
          <ProjectItem
            key={project.path}
            project={project}
            status={status}
            favicon={null}
            isSelected={index === 0}
            onClick={() => {}}
          />
        ))}
      </div>
      <div className="space-y-3 border border-slate-200 bg-slate-50 p-3">
        {SAMPLE_PROJECT_ITEMS.map(({ project, status }, index) => (
          <ProjectItem
            key={`${project.path}-compact`}
            project={project}
            status={status}
            favicon={null}
            isSelected={index === 0}
            isCollapsed
            onClick={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

function SettingsSectionGrid({
  theme,
  config,
}: {
  theme: ExportTheme;
  config: Config;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="AI" theme={theme}>
        <AISettingsSection config={config} isDaemonConnected onSave={() => {}} />
      </Panel>
      <Panel title="Tools" theme={theme}>
        <ToolsSettingsSection config={config} onSave={() => {}} />
      </Panel>
      <Panel title="Appearance" theme={theme}>
        <AppearanceSettingsSection />
      </Panel>
      <Panel title="Capture" theme={theme}>
        <CaptureSettingsSection config={config} onSave={() => {}} />
      </Panel>
      <Panel title="Application" theme={theme} className="lg:col-span-2">
        <AppSettingsSection
          config={config}
          isDaemonConnected
          appVersion="4.0.2"
          updateState={UPDATE_AVAILABLE}
        />
      </Panel>
    </div>
  );
}

export function FigmaExportScreensPage() {
  const searchParams = useSearchParams();
  const exportTheme = getExportTheme(searchParams.get("theme"));
  const isDark = exportTheme === "dark";
  const { ready } = useExportBootstrap(exportTheme);

  if (!ready) {
    return <div className={`min-h-screen ${isDark ? "bg-slate-950" : "bg-[#f4f7fb]"}`} />;
  }

  return (
    <main className={`min-h-screen px-10 py-12 ${isDark ? "bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-950"}`}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-10">
        <ExportHeader
          title={`${isDark ? "Dark" : "Light"} Core App Screens`}
          description={`A ${exportTheme}-mode board of the primary ViboGit application shells. These frames are intended for direct HTML-to-Figma capture so the file contains the main navigational screens in a consistent visual system.`}
          theme={exportTheme}
        />

        <Frame
          title="Main Workspace"
          description="Connected repository view with sidebar, commit workflow, prompt composer, and live repository status."
          theme={exportTheme}
        >
          <div className="h-[860px] overflow-hidden">
            <AppLayout initialActivePane="project">
              <MainInterface />
            </AppLayout>
          </div>
        </Frame>

        <div className="grid gap-8 xl:grid-cols-2">
          <Frame
            title="Tree Workspace"
            description="Full application shell with the tree tab active and a source file selected."
            theme={exportTheme}
          >
            <div className="h-[860px] overflow-hidden">
              <AppLayout initialActivePane="project">
                <MainInterface
                  initialActiveView="tree"
                  initialSelectedFile={{
                    path: "packages/ui/src/lib/daemon-context.tsx",
                    name: "daemon-context.tsx",
                  }}
                />
              </AppLayout>
            </div>
          </Frame>

          <Frame
            title="Graph Workspace"
            description="Full application shell with the commit graph tab active for branch and history inspection."
            theme={exportTheme}
          >
            <div className="h-[860px] overflow-hidden">
              <AppLayout initialActivePane="project">
                <MainInterface initialActiveView="graph" />
              </AppLayout>
            </div>
          </Frame>
        </div>

        <Frame
          title="Logs Workspace"
          description="Full application shell with live development server logs active in the primary content area."
          theme={exportTheme}
        >
          <div className="h-[860px] overflow-hidden">
            <AppLayout initialActivePane="project">
              <MainInterface initialActiveView="logs" />
            </AppLayout>
          </div>
        </Frame>

        <div className="grid gap-8 xl:grid-cols-2">
          <Frame
            title="Welcome State"
            description="The empty-project shell with app chrome, ready for first repository selection."
            theme={exportTheme}
          >
            <div className="h-[760px] overflow-hidden">
              <AppLayout initialActivePane="project">
                <WelcomeScreen />
              </AppLayout>
            </div>
          </Frame>

          <Frame
            title="Settings State"
            description="The settings shell rendered directly in the app layout for design review and documentation."
            theme={exportTheme}
          >
            <div className="h-[760px] overflow-hidden">
              <AppLayout initialActivePane="settings">
                <MainInterface />
              </AppLayout>
            </div>
          </Frame>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.35fr_0.85fr]">
          <Frame
            title="Desktop Onboarding"
            description="The browser-only onboarding screen shown when the Tauri backend is unavailable."
            theme={exportTheme}
          >
            <div className="h-[620px] overflow-hidden">
              <OnboardingScreen />
            </div>
          </Frame>

          <Frame
            title="Mini View"
            description="Compact always-on-top status bar for quick pull, fetch, push, and PR access."
            theme={exportTheme}
          >
            <div className={`h-[132px] p-6 ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
              <div className={`overflow-hidden border ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
                <MiniView />
              </div>
            </div>
          </Frame>
        </div>
      </div>
    </main>
  );
}

export function FigmaExportComponentsPage() {
  const searchParams = useSearchParams();
  const exportTheme = getExportTheme(searchParams.get("theme"));
  const isDark = exportTheme === "dark";
  const themedSettingsConfig = { ...SETTINGS_CONFIG, theme: exportTheme };
  const { ready, repoPath } = useExportBootstrap(exportTheme);
  const [selectedFile, setSelectedFile] = useState<GitFile | null>(SAMPLE_STATUS.staged[0] ?? null);

  if (!ready) {
    return <div className={`min-h-screen ${isDark ? "bg-slate-950" : "bg-[#f4f7fb]"}`} />;
  }

  return (
    <main className={`min-h-screen px-10 py-12 ${isDark ? "bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-950"}`}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-10">
        <ExportHeader
          title={`${isDark ? "Dark" : "Light"} Components, Panels, and States`}
          description={`A broader ${exportTheme}-mode export covering navigation, project state, repository panels, settings sections, modal surfaces, and utility components that are not obvious from a single app shell.`}
          theme={exportTheme}
        />

        <Frame
          title="Navigation System"
          description="Tabs, project list items, and compact project representations."
          theme={exportTheme}
          className="p-6"
        >
          <div className="space-y-6">
            <div className="overflow-hidden border border-slate-200 bg-white">
              <TabBar />
            </div>
            <SidebarProjectShowcase />
          </div>
        </Frame>

        <div className="grid gap-8 xl:grid-cols-[0.7fr_1.3fr]">
          <Frame
            title="Branch and Update Controls"
            description="Top-level repository controls and update banner states."
            theme={exportTheme}
            className="p-6"
          >
            <div className="space-y-6">
              <BranchSelector currentBranch={SAMPLE_BRANCHES[0]} branches={SAMPLE_BRANCHES} />
              <UpdateBanner {...UPDATE_AVAILABLE} />
              <UpdateBanner {...DOWNLOADING_UPDATE} />
              <UpdateBanner {...READY_UPDATE} />
            </div>
          </Frame>

          <Frame
            title="Commit Flow"
            description="The staged-changes workflow for selecting files, drafting a commit, and reviewing content."
            theme={exportTheme}
          >
            <div className="h-[620px] overflow-hidden">
              <StagedChanges repoPath={repoPath} />
            </div>
          </Frame>
        </div>

        <Frame
          title="Changes and Diff Review"
          description="Modified file list with side-by-side diff context used in day-to-day review."
          theme={exportTheme}
        >
          <div className="grid h-[560px] gap-0 xl:grid-cols-[360px_1fr]">
            <div className="border-r border-slate-200">
              <ChangesPanel
                status={SAMPLE_STATUS}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
              />
            </div>
            <ChangesDrawer file={selectedFile} repoPath={repoPath} />
          </div>
        </Frame>

        <Frame
          title="Files and Source"
          description="File tree explorer paired with the in-app source viewer."
          theme={exportTheme}
        >
          <div className="grid h-[600px] gap-0 xl:grid-cols-[340px_1fr]">
            <div className="border-r border-slate-200">
              <FileTree
                repoPath={repoPath}
                selectedPath="packages/ui/src/lib/daemon-context.tsx"
                onFileSelect={() => {}}
              />
            </div>
            <CodeViewer
              filePath="packages/ui/src/lib/daemon-context.tsx"
              fileName="daemon-context.tsx"
              repoPath={repoPath}
            />
          </div>
        </Frame>

        <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <Frame
            title="History Graph"
            description="Commit graph and commit metadata view."
            theme={exportTheme}
          >
            <div className="h-[520px] overflow-hidden p-4">
              <div className={`h-full border ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
                <CommitHistory repoPath={repoPath} limit={6} />
              </div>
            </div>
          </Frame>

          <Frame
            title="Dev Server Tools"
            description="Detected server controls and command configuration card."
            theme={exportTheme}
          >
            <div className="p-4">
              <div className={`border ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
                <DevServerPanel repoPath={repoPath} />
              </div>
            </div>
          </Frame>
        </div>

        <Frame
          title="Prompt Composition"
          description="The prompt box used to draft terminal instructions with file and skill references."
          theme={exportTheme}
          className="p-6"
        >
          <PromptBox
            defaultValue="Review the light-mode export route and compare it against the main workspace capture before finalizing the Figma handoff."
            projectFiles={[
              "packages/ui/src/components/main-interface.tsx",
              "packages/ui/src/components/settings-panel.tsx",
              "packages/ui/src/lib/daemon-context.tsx",
              "apps/desktop/frontend/src/app/figma-export/export-boards.tsx",
            ]}
            recentFiles={[
              "packages/ui/src/components/main-interface.tsx",
              "packages/ui/src/components/settings-panel.tsx",
            ]}
            onSubmit={() => {}}
            onCopy={() => {}}
            onClear={() => {}}
            terminalName="Ghostty"
            minHeight={140}
            maxHeight={220}
          />
        </Frame>

        <Frame
          title="Settings Sections"
          description="All settings tabs rendered as separate surfaces for token review and design cleanup."
          theme={exportTheme}
          className="p-6"
        >
          <SettingsSectionGrid theme={exportTheme} config={themedSettingsConfig} />
        </Frame>

        <Frame
          title="Pull Request Dialog"
          description="Modal presentation for AI-generated pull request drafting."
          theme={exportTheme}
        >
          <div className={`relative h-[720px] ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
            <CreatePRDialog
              isOpen
              inline
              onClose={() => {}}
              repoPath={repoPath}
              currentBranch={SAMPLE_BRANCHES[0]}
            />
          </div>
        </Frame>
      </div>
    </main>
  );
}
