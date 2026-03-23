# AI Settings Simplification — Testable Assertions

## Scope
Feature: Remove Gemini provider, remove model dropdown, hardcode default models for OpenAI (`gpt-5.4`) and Anthropic (`claude-sonnet-4-6-20260217`).

---

## A. Settings UI — Provider Selector

### VAL-AI-001: Only two providers appear in the dropdown
- **Title:** Provider dropdown lists exactly Anthropic and OpenAI
- **Behavioral description:** Open Settings → AI section. The provider `<select>` element contains exactly two `<option>` elements: one for Anthropic and one for OpenAI. No Gemini or any other provider option is present.
- **Pass:** Dropdown contains exactly 2 options; their display names map to Anthropic and OpenAI respectively.
- **Fail:** Gemini appears, or any provider other than the two specified appears, or fewer than 2 options exist.
- **Evidence:** Screenshot/snapshot of the rendered `<select>` element; DOM inspection showing option values.

### VAL-AI-002: Anthropic is the default provider for new users
- **Title:** Default AI provider is Anthropic
- **Behavioral description:** Clear all localStorage (`vibogit-settings`) and daemon config (`~/.vibogit/config.json`). Open Settings → AI section. The provider dropdown is pre-selected to "Anthropic".
- **Pass:** `config.aiProvider === "anthropic"` and the dropdown visually shows the Anthropic option selected.
- **Fail:** Any other provider is selected by default.
- **Evidence:** Value of `DEFAULT_CONFIG.aiProvider` in `types.ts`; localStorage contents after fresh start; screenshot of dropdown.

### VAL-AI-003: Selecting OpenAI persists the provider choice
- **Title:** Switching provider to OpenAI saves correctly
- **Behavioral description:** Open Settings → AI section. Change provider from Anthropic to OpenAI. Close and reopen Settings. The provider dropdown still shows OpenAI.
- **Pass:** `config.aiProvider === "openai"` after reopening; the dropdown shows OpenAI selected.
- **Fail:** Provider reverts to Anthropic or any other value.
- **Evidence:** localStorage value of `aiProvider`; daemon config file content (if connected); screenshot.

### VAL-AI-004: Selecting Anthropic persists the provider choice
- **Title:** Switching provider to Anthropic saves correctly
- **Behavioral description:** Set provider to OpenAI first. Then change provider to Anthropic. Close and reopen Settings. The provider dropdown still shows Anthropic.
- **Pass:** `config.aiProvider === "anthropic"` after reopening.
- **Fail:** Provider reverts or shows a stale value.
- **Evidence:** localStorage value; screenshot.

---

## B. Settings UI — Model Dropdown Removal

### VAL-AI-005: No model dropdown appears when Anthropic is selected
- **Title:** Model selector is absent for Anthropic
- **Behavioral description:** Open Settings → AI section with Anthropic selected as provider. There is no "Model" label or `<select>` for choosing a model anywhere in the AI settings section.
- **Pass:** No model dropdown rendered in the DOM.
- **Fail:** A model dropdown or any model selection UI is visible.
- **Evidence:** DOM inspection for absence of a second `<select>` or any element with label "Model"; screenshot.

### VAL-AI-006: No model dropdown appears when OpenAI is selected
- **Title:** Model selector is absent for OpenAI
- **Behavioral description:** Open Settings → AI section with OpenAI selected as provider. There is no "Model" label or `<select>` for choosing a model anywhere in the AI settings section.
- **Pass:** No model dropdown rendered in the DOM.
- **Fail:** A model dropdown or any model selection UI is visible.
- **Evidence:** DOM inspection; screenshot.

### VAL-AI-007: Anthropic hardcoded model is `claude-sonnet-4-6-20260217`
- **Title:** Anthropic provider uses correct hardcoded model
- **Behavioral description:** With Anthropic selected, trigger an AI operation (e.g., generate commit message). The model ID sent to the Tauri `invoke` call is exactly `claude-sonnet-4-6-20260217`.
- **Pass:** The `model` parameter in the `ai_generate_commit` or `ai_generate_pr` invoke equals `claude-sonnet-4-6-20260217`.
- **Fail:** Any other model string is used.
- **Evidence:** `AI_PROVIDERS` definition in `ai-service.ts`; network/invoke trace; unit test of `getModelForProvider("anthropic")`.

### VAL-AI-008: OpenAI hardcoded model is `gpt-5.4`
- **Title:** OpenAI provider uses correct hardcoded model
- **Behavioral description:** With OpenAI selected, trigger an AI operation. The model ID sent to the Tauri `invoke` call is exactly `gpt-5.4`.
- **Pass:** The `model` parameter equals `gpt-5.4`.
- **Fail:** Any other model string is used (e.g., old `gpt-5.3-codex-spark` or `gpt-4o-mini`).
- **Evidence:** `AI_PROVIDERS` definition; invoke trace; unit test of `getModelForProvider("openai")`.

---

## C. Settings UI — API Key

### VAL-AI-009: API key field is present and accepts input
- **Title:** API key input field renders and is editable
- **Behavioral description:** Open Settings → AI section. An API key input field (password type by default) is visible. Typing into it updates the value.
- **Pass:** Input field accepts keystrokes and displays masked characters.
- **Fail:** Field is missing, disabled, or read-only.
- **Evidence:** Screenshot; DOM inspection of `<input type="password">`.

### VAL-AI-010: API key placeholder updates when switching providers
- **Title:** Placeholder text matches the selected provider's key format
- **Behavioral description:** With Anthropic selected, the API key placeholder is `sk-ant-...`. Switch to OpenAI — the placeholder changes to `sk-...`.
- **Pass:** Placeholder text matches the `keyPlaceholder` defined for each provider in `AI_PROVIDERS`.
- **Fail:** Placeholder is stale, generic, or doesn't change on provider switch.
- **Evidence:** Screenshot of placeholder in both states; DOM attribute inspection.

### VAL-AI-011: "Get key" link updates when switching providers
- **Title:** Help link points to the correct provider's console
- **Behavioral description:** With Anthropic selected, the "Get key" link points to `https://console.anthropic.com`. Switch to OpenAI — the link changes to `https://platform.openai.com/api-keys`.
- **Pass:** `href` attribute matches the `keyHelpUrl` for the selected provider.
- **Fail:** Link is stale, missing, or points to the wrong URL.
- **Evidence:** DOM `href` attribute; screenshot.

### VAL-AI-012: API key show/hide toggle works
- **Title:** Eye icon toggles API key visibility
- **Behavioral description:** Enter an API key. Click the eye icon button. The input type changes from `password` to `text`, revealing the key. Click again — it reverts to `password`.
- **Pass:** Input type toggles between `password` and `text` on each click; aria-label toggles between "Show API key" and "Hide API key".
- **Fail:** Toggle doesn't change input type, or button is non-functional.
- **Evidence:** DOM input type attribute before/after click; aria-label values.

### VAL-AI-013: API key persists across settings open/close
- **Title:** Entered API key is saved
- **Behavioral description:** Enter an API key value (e.g., `sk-ant-test123`). Close settings. Reopen settings. The API key field contains the same value.
- **Pass:** `config.aiApiKey === "sk-ant-test123"` after reopening.
- **Fail:** API key is blank or different.
- **Evidence:** localStorage value; config file content.

### VAL-AI-014: API key is NOT cleared when switching providers
- **Title:** Provider switch preserves the API key
- **Behavioral description:** Enter an API key while Anthropic is selected. Switch provider to OpenAI. The API key field still contains the previously entered key.
- **Pass:** `config.aiApiKey` value unchanged after provider switch.
- **Fail:** API key is cleared or reset.
- **Evidence:** Field value after switch; localStorage contents.

### VAL-AI-015: Storage location message reflects daemon connection
- **Title:** Storage indicator shows correct persistence target
- **Behavioral description:** When the daemon is connected, the text below the API key field reads "Stored in ~/.vibogit/config.json". When disconnected, it reads "Stored locally in your browser".
- **Pass:** Text matches the `isDaemonConnected` state.
- **Fail:** Text is wrong or missing.
- **Evidence:** Screenshot in both connected and disconnected states.

---

## D. Gemini Removal

### VAL-AI-016: Gemini is not present in the provider type
- **Title:** `AiProvider` type excludes "gemini"
- **Behavioral description:** The `AiProvider` type in `packages/shared/src/types.ts` is `"anthropic" | "openai"` — no `"gemini"` literal.
- **Pass:** TypeScript compilation succeeds; `"gemini"` is not in the union.
- **Fail:** `"gemini"` still exists in the type or compilation fails due to references.
- **Evidence:** Source code of `types.ts`; `bun run typecheck` passes clean.

### VAL-AI-017: Gemini is not in `AI_PROVIDERS` array
- **Title:** `AI_PROVIDERS` contains exactly 2 entries (Anthropic, OpenAI)
- **Behavioral description:** The `AI_PROVIDERS` array in `ai-service.ts` has exactly 2 elements with `id` values `"anthropic"` and `"openai"`.
- **Pass:** `AI_PROVIDERS.length === 2`; no entry with `id === "gemini"`.
- **Fail:** Array contains a Gemini entry or has unexpected length.
- **Evidence:** Source code inspection; unit test.

### VAL-AI-018: Gemini references removed from Rust backend
- **Title:** Rust `commands.rs` has no Gemini match arms
- **Behavioral description:** The `"gemini"` match arms in `ai_generate_commit`, `ai_generate_pr`, and related Rust functions are removed or produce an appropriate error.
- **Pass:** No functional Gemini code path; passing "gemini" as provider returns an error.
- **Fail:** Gemini code path still exists and could be invoked.
- **Evidence:** Source grep of `commands.rs`; Rust compilation succeeds.

---

## E. Migration — Existing Gemini Users

### VAL-AI-019: Existing config with `aiProvider: "gemini"` falls back to default
- **Title:** Gemini config migrates to default provider on load
- **Behavioral description:** Set localStorage `vibogit-settings` to `{"aiProvider": "gemini", "aiApiKey": "AIza-old-key", "aiModel": "gemini-2.0-flash-exp"}`. Open the app. The provider dropdown shows Anthropic (the default), not Gemini. The AI key field may be cleared or preserved (either is acceptable, but provider MUST be valid).
- **Pass:** `config.aiProvider` is `"anthropic"` (or `"openai"`) — any valid provider. The app does not crash. No Gemini option is shown.
- **Fail:** App crashes, shows blank provider, or shows "gemini" text in the dropdown.
- **Evidence:** Console logs; localStorage after migration; screenshot of settings.

### VAL-AI-020: Existing config with `aiProvider: "gemini"` in daemon config migrates
- **Title:** Daemon-side Gemini config migrates gracefully
- **Behavioral description:** Manually set `~/.vibogit/config.json` with `"aiProvider": "gemini"`. Start the app with daemon connected. The fetched config returns a valid provider (not "gemini").
- **Pass:** `config.aiProvider` is `"anthropic"` or `"openai"` after daemon config load.
- **Fail:** App receives `"gemini"` and renders broken UI.
- **Evidence:** Daemon getConfig response; rendered provider dropdown.

### VAL-AI-021: Stale `aiModel` from old config does not cause errors
- **Title:** Old model IDs (e.g., `gpt-4o-mini`, `gemini-2.0-flash-exp`) are ignored gracefully
- **Behavioral description:** Set `aiModel: "gpt-4o-mini"` in localStorage. Open the app. The model used for AI operations is the hardcoded default for the selected provider, not the stale stored value.
- **Pass:** `getModelForProvider("openai", "gpt-4o-mini")` returns `"gpt-5.4"` (the hardcoded model) since `"gpt-4o-mini"` is no longer in the models list.
- **Fail:** The stale model ID is sent to the API, potentially causing errors.
- **Evidence:** Unit test of `getModelForProvider`; invoke trace.

---

## F. AI Commit Message Generation

### VAL-AI-022: AI commit button is visible and functional
- **Title:** AI commit button renders with sparkles icon
- **Behavioral description:** Stage or have changes in the repo. The commit message area shows a button with a sparkles icon labeled "AI".
- **Pass:** Button is visible and not disabled (assuming changes exist).
- **Fail:** Button is missing or always disabled.
- **Evidence:** Screenshot; DOM inspection.

### VAL-AI-023: Clicking AI commit without API key shows error
- **Title:** Missing API key produces user-facing error
- **Behavioral description:** Clear the API key in settings. Click the AI commit button.
- **Pass:** An error tooltip/message appears: "Please configure your AI API key in settings".
- **Fail:** No error shown, or a cryptic/unhandled error appears.
- **Evidence:** Screenshot of error message; DOM content.

### VAL-AI-024: AI commit sends correct provider and model to backend
- **Title:** Commit generation uses selected provider and hardcoded model
- **Behavioral description:** Set provider to OpenAI with a valid API key. Click AI commit. The `ai_generate_commit` Tauri invoke receives `provider: "openai"` and `model: "gpt-5.4"`.
- **Pass:** Invoke parameters match expected provider and model.
- **Fail:** Wrong provider or model is sent.
- **Evidence:** Tauri invoke intercept/log; unit test.

### VAL-AI-025: AI commit button shows provider name in tooltip
- **Title:** AI button tooltip reflects current provider
- **Behavioral description:** With Anthropic selected, hover over the AI commit button. The `title` attribute shows text including "Anthropic" (the display name). Switch to OpenAI — tooltip updates to include "OpenAI".
- **Pass:** `title` attribute contains the current provider's `displayName`.
- **Fail:** Tooltip is stale, generic, or missing.
- **Evidence:** DOM `title` attribute; screenshot on hover.

### VAL-AI-026: AI commit generation shows loading state
- **Title:** Spinner replaces icon during generation
- **Behavioral description:** Click AI commit with valid config. While the request is in flight, the sparkles icon is replaced with a spinning loader icon, and the button is disabled.
- **Pass:** Loader icon visible; button `disabled` attribute is true during generation.
- **Fail:** No loading indicator; button remains clickable during generation.
- **Evidence:** Screenshot during loading; DOM state.

### VAL-AI-027: Successful AI commit generation populates the message field
- **Title:** Generated message is inserted into the commit textarea
- **Behavioral description:** Click AI commit with valid config and staged changes. After successful generation, the commit message textarea contains the AI-generated text.
- **Pass:** `onMessageGenerated` callback fires with a non-empty string; textarea value updates.
- **Fail:** Textarea remains empty or callback not invoked.
- **Evidence:** Textarea value after generation; callback invocation.

### VAL-AI-028: AI commit generation failure shows error message
- **Title:** Backend error surfaces user-friendly message
- **Behavioral description:** Set an invalid API key (e.g., `sk-invalid`). Click AI commit. An error message appears near the button.
- **Pass:** Error element visible with descriptive text (e.g., "Failed to generate commit message" or the API error).
- **Fail:** Silent failure or unhandled exception.
- **Evidence:** Screenshot; error element content.

---

## G. AI PR Description Generation

### VAL-AI-029: PR dialog "Generate with AI" button is visible
- **Title:** AI generation button appears in the Create PR dialog
- **Behavioral description:** Open the Create PR dialog. A "Generate with AI" button with sparkles icon is visible near the Title label.
- **Pass:** Button is rendered and clickable.
- **Fail:** Button is missing.
- **Evidence:** Screenshot; DOM inspection.

### VAL-AI-030: Clicking PR generate without API key shows error
- **Title:** Missing API key produces error in PR dialog
- **Behavioral description:** Clear the API key. Open Create PR dialog. Click "Generate with AI".
- **Pass:** Error message "Please configure your AI API key in settings" appears in the dialog.
- **Fail:** No error or unhandled exception.
- **Evidence:** Screenshot; error element content.

### VAL-AI-031: PR generation sends correct provider and model
- **Title:** PR generation uses selected provider and hardcoded model
- **Behavioral description:** Set provider to Anthropic with valid key. Click "Generate with AI" in PR dialog. The `ai_generate_pr` invoke receives `provider: "anthropic"` and `model: "claude-sonnet-4-6-20260217"`.
- **Pass:** Invoke parameters match.
- **Fail:** Wrong provider or model sent.
- **Evidence:** Invoke trace; unit test.

### VAL-AI-032: Successful PR generation populates title and description
- **Title:** Generated PR content fills both fields
- **Behavioral description:** Click "Generate with AI" with valid config and commits. After success, both the title input and description textarea contain AI-generated text.
- **Pass:** `title` and `description` state variables are non-empty; fields display the content.
- **Fail:** Either field remains empty.
- **Evidence:** Screenshot; field values.

---

## H. Settings UI — Layout & Visual

### VAL-AI-033: AI settings section has exactly 2 visible controls (provider + API key)
- **Title:** Simplified AI settings layout
- **Behavioral description:** Open Settings → AI section. The section contains exactly: (1) a "AI Provider" dropdown and (2) an "API Key" input with show/hide toggle and "Get key" link. No model selector, no advanced options.
- **Pass:** Exactly 2 form groups visible.
- **Fail:** More than 2 form groups (e.g., model dropdown still present) or fewer.
- **Evidence:** Screenshot; DOM structure count.

### VAL-AI-034: Switching providers does not flash a model dropdown momentarily
- **Title:** No model dropdown flicker on provider switch
- **Behavioral description:** Rapidly switch between Anthropic and OpenAI in the provider dropdown. At no point does a model dropdown appear, even briefly.
- **Pass:** No model `<select>` is ever rendered during transitions.
- **Fail:** Model dropdown flashes or renders momentarily.
- **Evidence:** Manual observation; automated DOM mutation observer test.

---

## I. Type Safety & Build

### VAL-AI-035: TypeScript compilation succeeds with no Gemini type errors
- **Title:** `bun run typecheck` passes cleanly
- **Behavioral description:** Run `bun run typecheck` from the repo root. No type errors related to `"gemini"`, `AiProvider`, `aiModel`, or AI settings.
- **Pass:** Exit code 0; no relevant errors.
- **Fail:** Type errors referencing removed Gemini type or stale model references.
- **Evidence:** Typecheck output.

### VAL-AI-036: No runtime references to "gemini" in frontend bundle
- **Title:** Gemini strings removed from production build
- **Behavioral description:** Run `bun run build` for the frontend. Search the output bundle files for the string `"gemini"`.
- **Pass:** No occurrences of `"gemini"` in the built JS/HTML files (related to AI provider context).
- **Fail:** Gemini provider string found in production bundle.
- **Evidence:** `grep -r "gemini" apps/desktop/frontend/out/`.

### VAL-AI-037: `getModelForProvider` returns hardcoded models for valid providers
- **Title:** Model resolution returns correct defaults
- **Behavioral description:** Call `getModelForProvider("anthropic")` → returns `"claude-sonnet-4-6-20260217"`. Call `getModelForProvider("openai")` → returns `"gpt-5.4"`. Call `getModelForProvider("gemini")` → returns the fallback default (not a Gemini model).
- **Pass:** All three calls return expected values.
- **Fail:** Any call returns an unexpected model ID.
- **Evidence:** Unit test output.

### VAL-AI-038: `getProviderById` returns undefined for "gemini"
- **Title:** Gemini provider lookup returns undefined
- **Behavioral description:** Call `getProviderById("gemini")`.
- **Pass:** Returns `undefined`.
- **Fail:** Returns a provider object.
- **Evidence:** Unit test output.

---

## J. Edge Cases

### VAL-AI-039: Empty `aiModel` in config does not break AI operations
- **Title:** Blank model string resolves to provider default
- **Behavioral description:** Set `aiModel: ""` in config. Trigger an AI operation. The system uses the hardcoded default model for the selected provider.
- **Pass:** AI operation proceeds with the correct default model.
- **Fail:** Error due to empty model string, or wrong model used.
- **Evidence:** Invoke parameters; unit test of `getModelForProvider("openai", "")`.

### VAL-AI-040: Unknown `aiModel` in config does not break AI operations
- **Title:** Unrecognized model string resolves to provider default
- **Behavioral description:** Set `aiModel: "nonexistent-model-v99"` in config. Trigger an AI operation. The system falls back to the hardcoded default model.
- **Pass:** `getModelForProvider("openai", "nonexistent-model-v99")` returns `"gpt-5.4"`.
- **Fail:** The nonexistent model is sent to the API.
- **Evidence:** Unit test; invoke trace.

### VAL-AI-041: Switching provider auto-sets the correct model in config
- **Title:** Provider switch writes new default model to config
- **Behavioral description:** Select OpenAI in the dropdown. The `onSave` call includes `aiModel` set to the OpenAI provider's default model (`"gpt-5.4"`). Switch to Anthropic — `aiModel` is set to Anthropic's default.
- **Pass:** `config.aiModel` matches the hardcoded model of the newly selected provider after each switch.
- **Fail:** `aiModel` retains the previous provider's model or is empty.
- **Evidence:** `onSave` call arguments; localStorage/config contents after switch.

### VAL-AI-042: No changes to non-AI settings when switching AI provider
- **Title:** Provider switch does not affect other config fields
- **Behavioral description:** Set a specific editor, terminal, theme, and GitHub PAT. Switch AI provider. All non-AI settings remain unchanged.
- **Pass:** `config.editor`, `config.terminal`, `config.theme`, `config.githubPat` are identical before and after provider switch.
- **Fail:** Any non-AI config field is modified.
- **Evidence:** Config snapshot comparison.

### VAL-AI-043: Concurrent rapid provider switches settle correctly
- **Title:** Rapid toggling between providers resolves to last selection
- **Behavioral description:** Quickly toggle between Anthropic and OpenAI 5 times. The final state matches the last selected provider.
- **Pass:** After settling, `config.aiProvider` matches the last selection; no stale state.
- **Fail:** Provider is incorrect or UI is in an inconsistent state.
- **Evidence:** Final config value; screenshot.

---

**Total assertions: 43**
