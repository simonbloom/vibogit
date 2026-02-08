---
title: "Desktop App Skills Discovery"
created: 2026-02-08
status: approved
project11_id: pd7bbhwkd3f4s5qpbb76y2xkvs80sfcj
tags: [desktop, tauri, skills, feature]
---

# PRD: Desktop App Skills Discovery

## Problem Statement

The vibogit desktop app's skills feature is non-functional. When users type `/` in the prompt box to access skills, they see "No skills found in ~/.factory/skills/" even when skills exist. This is because the Tauri backend's `list_skills` command returns an empty array stub, while the actual skill-loading logic exists only in the Node.js daemon.

## Goals & Success Metrics

| Goal | Success Metric |
|------|----------------|
| Skills load correctly | Skills from `~/.factory/skills/` appear in autocomplete |
| Feature parity with daemon | Same skill directories searched as daemon |
| Fast skill loading | Skills load in < 100ms on app startup |

## User Stories

1. **As a user**, I want to see my Factory skills when I type `/` so I can quickly reference them.
2. **As a user**, I want skills loaded from standard Factory locations so my existing setup works.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Load skills from `~/.factory/skills/` | Must Have |
| FR2 | Load skills from `FACTORY_SKILLS_PATH` env var | Must Have |
| FR3 | Load skills from `FACTORY_HOME/skills` env var | Must Have |
| FR4 | Parse SKILL.md YAML frontmatter for name/description | Must Have |
| FR5 | Deduplicate skills by path | Must Have |
| FR6 | Show helpful empty state with link when no skills found | Should Have |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR1 | Skill loading completes in < 100ms | Should Have |
| NFR2 | No panic on malformed SKILL.md files | Must Have |

## Technical Considerations

**Files to Modify:**
- `apps/desktop/src-tauri/src/commands.rs` - Implement `list_skills` command

**Skill Directory Structure:**
```
~/.factory/skills/
├── my-skill/
│   └── SKILL.md      # Contains YAML frontmatter
├── another-skill/
│   └── SKILL.md
```

**SKILL.md Format:**
```markdown
---
name: "My Skill"
description: "Does something useful"
---

# Skill content...
```

## ASCII Architecture

```
+------------------+     +-------------------+     +------------------+
|   Frontend UI    |     |   Tauri Bridge    |     |   Rust Backend   |
|                  |     |                   |     |                  |
| PromptBox        |---->| invoke()          |---->| list_skills()    |
| - types "/"      |     | "list_skills"     |     |                  |
| - shows panel    |<----| returns Vec<Skill>|<----| scan_skills_dir()|
|                  |     |                   |     | parse_frontmatter|
+------------------+     +-------------------+     +------------------+
```

## ASCII UX Flow

```
[User types "/"] --> [Skill Panel Opens] --> [Skills Listed]
                            |
                            v
                    [No skills?] ---> [Show empty state + link]
```

## Implementation Approach

```rust
// Pseudocode for commands.rs

fn get_skills_directories() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    
    // 1. FACTORY_SKILLS_PATH env var
    if let Ok(p) = env::var("FACTORY_SKILLS_PATH") {
        paths.push(PathBuf::from(p));
    }
    
    // 2. FACTORY_HOME/skills env var
    if let Ok(home) = env::var("FACTORY_HOME") {
        paths.push(PathBuf::from(home).join("skills"));
    }
    
    // 3. ~/.factory/skills/
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join(".factory").join("skills"));
    }
    
    paths
}

fn scan_skills_directory(path: &Path) -> Vec<Skill> {
    // For each subdirectory with SKILL.md:
    // - Read file, parse frontmatter, extract name/description
    // - Return Skill { name, description, path }
}

fn parse_skill_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    // Match ---\n...\n--- pattern
    // Extract name: and description: fields
}
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Malformed SKILL.md crashes app | Wrap in try/catch, skip bad files |
| Slow filesystem scan | Cache skills, refresh on focus |
| Missing `dirs` crate | Already used in project for config |

## Open Questions

- None - implementation is straightforward port from daemon

## Acceptance Criteria

- [ ] Skills from `~/.factory/skills/` appear in autocomplete panel
- [ ] Skills from `FACTORY_SKILLS_PATH` env var are loaded
- [ ] Skills from `FACTORY_HOME/skills` env var are loaded
- [ ] SKILL.md frontmatter parsed correctly for name/description
- [ ] Duplicate skills (same path) are deduplicated
- [ ] Malformed SKILL.md files are skipped without crashing
- [ ] Empty state shows helpful message when no skills found
