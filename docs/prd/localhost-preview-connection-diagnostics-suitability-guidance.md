---
title: "Localhost Preview Connection Diagnostics & Suitability Guidance"
created: 2026-02-15
status: approved
project11_id: pd7cq224775t559kgfrzq0r4dn817k2a
tags: [vibogit, localhost, diagnostics, ux, monorepo]
---

# PRD: Localhost Preview Connection Diagnostics & Suitability Guidance

## 1) Problem Statement
Users click **Connect** and get generic failures (often just "Failed to connect") even when a project is likely runnable. In monorepos and mixed-stack repos, the app may use the wrong folder/command/port assumptions, causing confusion and failed preview attempts.

## 2) Goals (V1 = Full Option 2, Must-have Next Release)
- Replace generic failure with specific, actionable diagnosis.
- Detect likely non-previewable projects early and communicate clearly.
- Improve recovery UX with guided next steps and copyable AI troubleshooting prompt.

## 3) Primary Persona
Mixed users (beginner + technical), with plain-language default and expandable technical detail.

## 4) Success Metrics
### Primary KPI
- Reduce generic `"Failed to connect"` surfaced errors by **>=80%**.

### Secondary KPIs
- Increase first-attempt successful preview rate by **>=25%**.
- Reduce median time-to-recovery after failed connect by **>=40%**.
- Reduce support requests about localhost preview failures by **>=30%**.

## 5) User Stories
- As a user, when Connect fails, I want to know **why** and **what to do next** immediately.
- As a user in a monorepo, I want to pick/correct app folder and retry without guessing.
- As a vibe coder, I want a one-click prompt I can paste into an LLM for help.

## 6) Functional Requirements
1. **Reason-code diagnostics** from backend (`MONOREPO_WRONG_CWD`, `PORT_MISMATCH`, `STARTUP_TIMEOUT`, `COMMAND_FAILED`, `PROTOCOL_MISMATCH`, `NOT_PREVIEWABLE`).
2. **Preflight suitability classifier** before launch (web-previewable vs likely not previewable).
3. **Monorepo working-directory support** (detect/suggest subfolder; allow user override).
4. **Multi-probe connectivity checks** (localhost/127.0.0.1/::1 and http/https).
5. **Error cards** with: headline, meaning, 1–3 fix steps, primary CTA, secondary CTA, copy AI prompt.
6. **Progress states** during connect: reading config, starting server, probing URL, connected/failed.
7. **Logs snippet integration** (last 30–50 lines) for diagnostics/prompt payload.

## 7) Non-Functional Requirements
- Diagnosis surfaced in <500ms after failure event.
- No secrets in logs/prompt payload.
- Works for common Next/Vite monorepo patterns.
- Backward compatible with existing connect flow.

## 8) UX Copy & Guidance Model
Each error card must include:
- **Headline (plain English)**
- **What this means**
- **Do this now** (1–3 steps)
- **Buttons** (`Retry`, `Choose folder`, `Edit port`, `Copy AI prompt`)

## 9) ASCII UI Mockup (Failure Card)

```text
+------------------------------------------------------------------+
| Connect to Local Preview                               [Retry]    |
+------------------------------------------------------------------+
| Status: Failed                                                    |
|------------------------------------------------------------------|
| We started in the wrong folder                                   |
| This repo is a monorepo. The dev command likely ran at root.     |
|                                                                  |
| Do this now:                                                      |
| 1) Choose app folder: apps/desktop/frontend                      |
| 2) Retry connect                                                  |
|                                                                  |
| [Choose folder] [Retry] [Copy AI prompt] [Show technical details]|
+------------------------------------------------------------------+
| Technical details (collapsed by default)                          |
| reason_code: MONOREPO_WRONG_CWD                                  |
| expected_port: 4158, observed_port: none                         |
+------------------------------------------------------------------+
```

## 10) ASCII UX Journey

```text
[User clicks Connect]
         |
         v
[Preflight suitability]
   | yes                          | no/uncertain
   v                              v
[Start dev server]          [Soft warning: may not be previewable]
   |                              | \
   v                              |  -> [Try anyway]
[Probe URL+port]                  -> [Choose folder]
   | success                      -> [Copy AI prompt]
   v
[Connected -> Open preview]
   |
   | failure
   v
[Diagnosis card + next actions + AI prompt]
```

## 11) AI Prompt Template (per failure)
```text
I’m trying to run local web preview and it fails.

Reason code: <REASON_CODE>
Repo: <PATH>
Command: <COMMAND>
Working directory used: <CWD_USED>
Suggested working directory: <CWD_SUGGESTED>
Expected port: <EXPECTED_PORT>
Observed ports: <OBSERVED_PORTS>
URL attempts: <URLS_TRIED>
Recent logs:
<LAST_40_LINES>

Please provide:
1) exact corrected command,
2) correct working directory,
3) AGENTS.md snippet to make this permanent,
4) 3 quick verification checks.
```

## 12) Risks & Mitigations
- **False classification (previewability):** use soft warning, not hard block.
- **Framework variance (port/protocol):** multi-probe strategy + detected values in UI.
- **Overwhelming beginners:** plain-language first, technical details collapsible.

## 13) Launch Plan
- Phase 1: reason codes + improved cards + AI prompt copy.
- Phase 2: suitability classifier + monorepo folder chooser + multi-probe enhancements.
- Phase 3: telemetry tuning and copy iteration based on failure analytics.

## 14) Acceptance Criteria
- [ ] Generic "Failed to connect" is replaced by mapped diagnosis in >=95% of failed attempts.
- [ ] Each diagnosis renders at least one primary fix CTA.
- [ ] Copy AI prompt includes reason code + command + cwd + logs snippet.
- [ ] Monorepo retry with selected folder succeeds in test fixture repos.
- [ ] Telemetry captures reason code, recovery action, and outcome.
