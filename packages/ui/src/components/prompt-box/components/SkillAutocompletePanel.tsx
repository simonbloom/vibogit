import { useRef, useEffect } from 'react'
import type { Skill } from '@vibogit/shared'

interface SkillAutocompletePanelProps {
  isOpen: boolean
  isConnected: boolean
  results: Skill[]
  selectedIndex: number
  position: { x: number; y: number }
  onSelect: (index: number) => void
}

export function SkillAutocompletePanel({
  isOpen,
  isConnected,
  results,
  selectedIndex,
  position,
  onSelect,
}: SkillAutocompletePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && panelRef.current) {
      const selected = panelRef.current.querySelector('[aria-selected="true"]')
      selected?.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen, selectedIndex])

  if (!isOpen) {
    return null
  }

  if (!isConnected) {
    return (
      <div
        ref={panelRef}
        className="absolute z-50 w-80 rounded-md border border-border bg-popover shadow-lg"
        style={{ top: position.y, left: position.x }}
      >
        <div className="px-3 py-4 text-sm text-muted-foreground text-center">
          Connect daemon to see skills
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div
        ref={panelRef}
        className="absolute z-50 w-80 rounded-md border border-border bg-popover shadow-lg"
        style={{ top: position.y, left: position.x }}
      >
        <div className="px-4 py-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">No skills found</p>
          <p className="text-xs mb-3">
            Skills are loaded from:<br />
            <code className="text-xs bg-muted px-1 py-0.5 rounded">~/.factory/skills/</code>
          </p>
          <a
            href="https://docs.factory.ai/skills"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Learn how to create skills
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Skill suggestions"
      className="absolute z-50 w-80 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg"
      style={{ top: position.y, left: position.x }}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Skills
      </div>
      {results.map((skill, idx) => (
        <div
          key={skill.path}
          role="option"
          aria-selected={selectedIndex === idx}
          onClick={() => onSelect(idx)}
          className={`px-3 py-2 cursor-pointer transition-colors ${
            selectedIndex === idx
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{skill.name}</span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              skill
            </span>
          </div>
          {skill.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {skill.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
