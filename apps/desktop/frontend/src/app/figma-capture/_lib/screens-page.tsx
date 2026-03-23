"use client";

import { AlertCircle, AlertTriangle, ExternalLink, GitPullRequest, Loader2, Sparkles, X } from "lucide-react";
import { AppLayout } from "@vibogit/ui/components/app-layout";
import { MainInterface } from "@vibogit/ui/components/main-interface";
import { MiniView } from "@vibogit/ui/components/mini-view";
import { OnboardingScreen } from "@vibogit/ui/components/onboarding-screen";
import { WelcomeScreen } from "@vibogit/ui/components/welcome-screen";
import { Button } from "@vibogit/ui/components/ui/button";
import { CaptureCard, DesktopPreview, FigmaPageHeader, FigmaSection, MiniPreview } from "./capture-shell";
import { FigmaMockProviders } from "./mock-providers";
import {
  MOCK_AUTH_STATUS,
  MOCK_CONFIG,
  MOCK_GITHUB_REPOS,
  MOCK_REPO_PATH,
  MOCK_UPDATE_STATE,
  createReadyDaemonState,
} from "./mock-data";

function AppPreview({
  daemonState,
  children,
  initialActivePane = "project",
  settingsInitialTab,
  autoUpdateOverride,
}: {
  daemonState: ReturnType<typeof createReadyDaemonState>;
  children: React.ReactNode;
  initialActivePane?: "project" | "settings";
  settingsInitialTab?: "ai" | "tools" | "appearance" | "capture" | "app";
  autoUpdateOverride?: typeof MOCK_UPDATE_STATE;
}) {
  return (
    <FigmaMockProviders daemonState={daemonState} config={MOCK_CONFIG}>
      <main className="h-full overflow-hidden">
        <AppLayout
          initialActivePane={initialActivePane}
          settingsInitialTab={settingsInitialTab}
          autoUpdateOverride={autoUpdateOverride}
        >
          {children}
        </AppLayout>
      </main>
    </FigmaMockProviders>
  );
}

function ConnectingState() {
  return (
    <main className="min-h-full">
      <div className="flex min-h-full flex-col items-center justify-center p-12">
        <Loader2 className="mb-2 h-6 w-6 animate-spin" />
        <p className="text-muted-foreground">Connecting...</p>
      </div>
    </main>
  );
}

function ErrorState() {
  return (
    <main className="min-h-full">
      <div className="flex min-h-full flex-col items-center justify-center p-12">
        <p className="font-medium text-destructive">Connection Error</p>
        <p className="mt-1 text-sm text-muted-foreground">Desktop backend is unavailable in this runtime.</p>
      </div>
    </main>
  );
}

function OverlayPreview({
  children,
  overlay,
}: {
  children: React.ReactNode;
  overlay: React.ReactNode;
}) {
  return (
    <div className="relative h-full w-full">
      {children}
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-8">{overlay}</div>
    </div>
  );
}

function CloneDialogPreview({ mode }: { mode: "url" | "repos" }) {
  return (
    <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 text-foreground shadow-xl">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold">Clone from GitHub</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a repository URL, or list repositories from your authenticated GitHub account.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={mode === "url" ? "default" : "outline"}>Paste URL</Button>
          <Button variant={mode === "repos" ? "default" : "outline"}>My Repositories</Button>
        </div>

        {mode === "repos" ? (
          <>
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
              Listing repositories with GitHub CLI auth ({MOCK_AUTH_STATUS.login}).
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value=""
                readOnly
                placeholder="Search repositories"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <Button variant="outline">Search</Button>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
              {MOCK_GITHUB_REPOS.map((repo, index) => (
                <div
                  key={repo.id}
                  className={`px-3 py-2 text-left ${index === 0 ? "bg-accent" : "bg-card"}`}
                >
                  <div className="text-sm font-medium">{repo.fullName}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{repo.private ? "Private" : "Public"}</span>
                    <span>Default: {repo.defaultBranch || "main"}</span>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full">
              Load more
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <label className="mb-1 block text-sm font-medium text-foreground">Repository URL</label>
            <input
              type="text"
              value="https://github.com/simonbloom/vibogit.git"
              readOnly
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Need the URL? Open the repository on GitHub, click <span className="font-medium">Code</span>, and copy
              the SSH or HTTPS URL.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Branch (optional)</label>
          <input
            type="text"
            value="main"
            readOnly
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <p className="text-xs text-muted-foreground font-mono truncate">Destination: {MOCK_REPO_PATH}</p>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Clone Here</Button>
      </div>
    </div>
  );
}

function CreatePRDialogPreview() {
  return (
    <div className="w-full max-w-2xl rounded-xl border border-border bg-card text-foreground shadow-xl">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <GitPullRequest className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold">Create Pull Request</h3>
        </div>
        <Button variant="ghost" size="icon">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded bg-muted px-2 py-1">feat/figma-capture</span>
          <span>→</span>
          <span className="rounded border border-border px-2 py-1 text-foreground">main</span>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Title</label>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs">
              <Sparkles className="mr-1 h-3 w-3" />
              Generate with AI
            </Button>
          </div>
          <input
            type="text"
            readOnly
            value="Add code-derived Figma capture routes for the desktop UI"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Description</label>
          <textarea
            rows={10}
            readOnly
            value={"## Summary\n- add three capture routes for screens, components, and style guide\n- reuse live UI components under deterministic mock state\n- import routes into the linked Figma file\n"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-border p-4">
        <Button variant="secondary">Cancel</Button>
        <Button>
          <ExternalLink className="h-4 w-4" />
          Open on GitHub
        </Button>
      </div>
    </div>
  );
}

function PortPromptPreview() {
  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Monorepo Detected</h3>
        <Button variant="ghost" size="icon">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
        <div className="text-sm">
          <p className="font-medium text-yellow-600">This project uses turbo/nx/lerna</p>
          <p className="mt-1 text-muted-foreground">
            Running &quot;bun run dev&quot; will start all workspaces. For a single app, open its folder directly in
            ViboGit.
          </p>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">Enter the port to monitor for the main application.</p>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Port Number</label>
          <input
            type="number"
            readOnly
            value="4158"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input checked readOnly type="checkbox" className="h-4 w-4 rounded border-border" />
          <span>Save port to agents.md for future use</span>
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Connect Anyway</Button>
      </div>

      <div className="mt-4 rounded-md bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> Add this to your agents.md to skip this prompt:
        </p>
        <code className="mt-1 block text-xs font-mono">- Dev server port: 4158</code>
      </div>
    </div>
  );
}

export function ScreensCapturePage() {
  const readyState = createReadyDaemonState();
  const noRepoState = createReadyDaemonState({ repoPath: null, status: null, branches: [] });
  const nonGitState = createReadyDaemonState({
    repoHealth: "nonGit",
    repoMessage: "Folder is empty or not initialized with Git yet.",
    status: null,
    branches: [],
  });

  return (
    <>
      <FigmaPageHeader
        eyebrow="Page 1"
        title="Screens"
        description="Route-level captures plus the key runtime states and overlays required to mirror the shipped desktop UI."
      />

      <FigmaSection title="Connection States" description="Top-level states from the app entry flow.">
        <CaptureCard label="Onboarding / Disconnected" meta="1440 × 900">
          <DesktopPreview>
            <FigmaMockProviders
              daemonState={createReadyDaemonState({
                connection: "disconnected",
                repoPath: null,
                status: null,
                branches: [],
                error: null,
              })}
            >
              <main className="h-full overflow-auto">
                <OnboardingScreen />
              </main>
            </FigmaMockProviders>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Connecting" meta="1440 × 900">
          <DesktopPreview>
            <FigmaMockProviders
              daemonState={createReadyDaemonState({
                connection: "connecting",
                repoPath: null,
                status: null,
                branches: [],
              })}
            >
              <ConnectingState />
            </FigmaMockProviders>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Connection Error" meta="1440 × 900">
          <DesktopPreview>
            <FigmaMockProviders
              daemonState={createReadyDaemonState({
                connection: "error",
                repoPath: null,
                status: null,
                branches: [],
                error: "Failed to connect to desktop backend",
              })}
            >
              <ErrorState />
            </FigmaMockProviders>
          </DesktopPreview>
        </CaptureCard>
      </FigmaSection>

      <FigmaSection title="Primary App Screens" description="Canonical app-shell captures using the real components under deterministic mock state.">
        <CaptureCard label="Welcome / No Repo Selected" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={noRepoState}>
              <WelcomeScreen />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Repo Not Ready" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={nonGitState}>
              <MainInterface />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Main App / Changes" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={readyState}>
              <MainInterface />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Main App / Tree" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={readyState}>
              <MainInterface
                initialActiveView="tree"
                initialSelectedFile={{
                  path: "packages/ui/src/components/main-interface.tsx",
                  name: "main-interface.tsx",
                }}
              />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Main App / Graph" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={readyState}>
              <MainInterface initialActiveView="graph" />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Main App / Logs" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={readyState}>
              <MainInterface initialActiveView="logs" />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>
      </FigmaSection>

      <FigmaSection title="Settings Screens" description="Each settings tab captured in the context of the full app shell.">
        <CaptureCard label="Settings / AI" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={readyState} initialActivePane="settings" settingsInitialTab="ai">
              <div />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Settings / Tools" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={readyState} initialActivePane="settings" settingsInitialTab="tools">
              <div />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Settings / Appearance" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={readyState} initialActivePane="settings" settingsInitialTab="appearance">
              <div />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Settings / Capture" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={readyState} initialActivePane="settings" settingsInitialTab="capture">
              <div />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Settings / App" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={readyState} initialActivePane="settings" settingsInitialTab="app">
              <div />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>
      </FigmaSection>

      <FigmaSection title="Mini View" description="Companion mini-window capture from the real mini-view component.">
        <CaptureCard label="Mini View" meta="680 × 56">
          <MiniPreview>
            <FigmaMockProviders daemonState={readyState} selectedProjectPath={MOCK_REPO_PATH}>
              <MiniView />
            </FigmaMockProviders>
          </MiniPreview>
        </CaptureCard>
      </FigmaSection>

      <FigmaSection title="Overlays" description="Modal and banner states represented on top of the app shell.">
        <CaptureCard label="Clone From GitHub / URL Mode" meta="1440 × 900">
          <DesktopPreview>
            <OverlayPreview overlay={<CloneDialogPreview mode="url" />}>
              <AppPreview daemonState={readyState}>
                <MainInterface />
              </AppPreview>
            </OverlayPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Clone From GitHub / Repository List" meta="1440 × 900">
          <DesktopPreview>
            <OverlayPreview overlay={<CloneDialogPreview mode="repos" />}>
              <AppPreview daemonState={readyState}>
                <MainInterface />
              </AppPreview>
            </OverlayPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Create Pull Request" meta="1440 × 900">
          <DesktopPreview>
            <OverlayPreview overlay={<CreatePRDialogPreview />}>
              <AppPreview daemonState={readyState}>
                <MainInterface />
              </AppPreview>
            </OverlayPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Port Prompt" meta="1440 × 900">
          <DesktopPreview>
            <OverlayPreview overlay={<PortPromptPreview />}>
              <AppPreview daemonState={readyState}>
                <MainInterface />
              </AppPreview>
            </OverlayPreview>
          </DesktopPreview>
        </CaptureCard>

        <CaptureCard label="Update Banner" meta="1440 × 900">
          <DesktopPreview>
            <AppPreview daemonState={readyState} autoUpdateOverride={MOCK_UPDATE_STATE}>
              <WelcomeScreen />
            </AppPreview>
          </DesktopPreview>
        </CaptureCard>
      </FigmaSection>
    </>
  );
}
