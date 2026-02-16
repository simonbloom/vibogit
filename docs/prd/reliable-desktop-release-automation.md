---
title: "Reliable Desktop Release Automation + Updater Integrity"
created: 2026-02-16
status: approved
tags: [release, automation, updater, desktop]
---

# PRD: Reliable Desktop Release Automation + Updater Integrity

## 1) Problem Statement

Releasing ViboGit currently requires multiple manual steps across version bumping, artifact generation, GitHub release publishing, and landing-page link updates. This creates a risk of mismatch between:

- App version shown in UI
- DMG file actually published
- Landing page download URL
- In-app updater metadata (`latest.json`)

When any step is missed, users can download wrong assets or fail to upgrade in-app.

## 2) Goals & Success Metrics

### Goals
1. Make desktop release publishing reliable and repeatable.
2. Ensure updater metadata and hosted assets are always aligned with the shipped version.
3. Ensure landing-page download links are updated every version bump.

### Success Metrics
- **100%** of releases contain required assets (`.dmg`, updater artifacts, `latest.json`).
- **0 manual edits** required for release URL updates on landing page after running release flow.
- In-app updater detects latest version within one check cycle for newly published release.
- Release flow completes via one command/path with deterministic output and validation.

## 3) Users / Stakeholders

- **Maintainer / release owner**: runs the release command.
- **End users (desktop app)**: download from landing page and receive in-app updates.
- **Contributors**: need predictable release process.

## 4) Scope

### In Scope
- Add repo-level release automation (script and/or workflow).
- Update `version-bump-build` skill to invoke canonical automation path.
- Publish release assets to GitHub Releases.
- Update landing page download link to current versioned asset every bump.
- Validate updater path from app trigger to `latest.json`.

### Out of Scope
- Rewriting updater architecture.
- Cross-platform package expansion beyond current release targets unless already present.
- Marketing/content redesign of landing page.

## 5) Functional Requirements

1. **Version Bump Synchronization** - Update all required version files in one operation. Validate version consistency before build.
2. **Clean Build** - Perform mandatory clean of frontend and Rust artifacts to avoid stale binaries. Build desktop artifacts with updater-compatible output.
3. **GitHub Release Publish** - Create or update tag/release `vX.Y.Z`. Upload DMG and updater artifacts required by Tauri updater. Ensure `latest.json` is present at latest release download path.
4. **Landing Page Link Update** - Replace download URL with the current versioned DMG URL on each release. Commit-able deterministic file diff for review. Fail release step if link update target is not found.
5. **Updater Integrity Check** - Confirm in-app update check points to GitHub `releases/latest/download/latest.json`. Validate release artifacts referenced by updater metadata exist.
6. **Single Reliable Entry Point** - Skill delegates to repo script/workflow (not ad hoc manual command sequences). Script emits clear pass/fail stage output.

## 6) Non-Functional Requirements

- **Reliability:** idempotent-ish behavior for retries (safe overwrite/upload path where possible).
- **Observability:** clear logs per stage (version, build, upload, link update, validation).
- **Safety:** abort on partial failure; no silent continuation.
- **Traceability:** output release URL, asset list, updated landing-page file path.

## 7) Technical Design

### Components
- **Release Orchestrator Script** (`scripts/release/release.sh`): canonical flow.
- **Preflight Checks** (`scripts/release/preflight.sh`): environment validation.
- **Artifact Validator** (`scripts/release/validate-artifacts.sh`): post-build contract checks.
- **Release Verifier** (`scripts/release/verify-release.sh`): post-publish verification + JSON report.
- **GitHub Release Integration** via `gh` CLI.
- **Landing Page Link Updater**: integrated into version bump stage.
- **Skill Update**: `version-bump-build` calls orchestrator with target version.

### High-level Flow
```
[Input version X.Y.Z]
      |
      v
[Preflight checks] --> [Version bump all files]
      |
      v
[Clean build (frontend + rust + bundle)]
      |
      v
[Artifact contract validation]
      |
      v
[Create/Update GitHub release vX.Y.Z + upload assets]
      |
      v
[Post-release verification + JSON report]
      |
      v
[Success output: release URL + updated file paths]
```

### Updater Path
```
[In-app "Check for updates"]
      |
      v
[Tauri updater client (@tauri-apps/plugin-updater)]
      |
      v
https://github.com/simonbloom/vibogit/releases/latest/download/latest.json
      |
      v
[Reads target version + platform asset URL/signature]
      |
      v
[Downloads + applies update]
```

## 8) Risks & Mitigations

1. **Missing updater artifacts** - Mitigation: pre-publish validation of expected files; block release if absent.
2. **Tag/release collision** - Mitigation: detect existing release; update assets or fail with clear option.
3. **Credential/environment issues** - Mitigation: preflight checks for auth and permissions.
4. **Partial success** - Mitigation: stage-gated flow; no "success" state until all required stages pass.

## 9) Rollout Plan

- Phase 1: Orchestrator script with preflight and artifact validation.
- Phase 2: GitHub release upload + landing page link update.
- Phase 3: Updater wiring verification + dry-run mode + JSON report.
- Phase 4: Skill updated to call orchestrator.

## 10) Open Questions

1. Preferred release notes strategy (auto-generated vs manual template).
2. Whether to support rollback command for failed post-publish link-update step.
