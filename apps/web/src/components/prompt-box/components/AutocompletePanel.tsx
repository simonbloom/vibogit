import { useRef, useEffect } from 'react'
import { FileOption } from './FileOption'

interface AutocompleteResult {
  path: string
  isRecent: boolean
}

interface AutocompletePanelProps {
  isOpen: boolean
  results: AutocompleteResult[]
  selectedIndex: number
  position: { x: number; y: number }
  onSelect: (index: number) => void
}

export function AutocompletePanel({
  isOpen,
  results,
  selectedIndex,
  position,
  onSelect,
}: AutocompletePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && panelRef.current) {
      const selected = panelRef.current.querySelector('[aria-selected="true"]')
      selected?.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen, selectedIndex])

  if (!isOpen || results.length === 0) {
    return null
  }

  const recentFiles = results.filter((r) => r.isRecent)
  const otherFiles = results.filter((r) => !r.isRecent)

  return (
    <div
      ref={panelRef}
      role="listbox"
      aria-label="File suggestions"
      className="absolute z-50 w-72 max-h-64 overflow-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg"
      style={{ top: position.y, left: position.x }}
    >
      {recentFiles.length > 0 && (
        <>
          <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Recent Files
          </div>
          {recentFiles.map((result, idx) => (
            <FileOption
              key={result.path}
              path={result.path}
              isRecent={result.isRecent}
              isHighlighted={selectedIndex === idx}
              onSelect={() => onSelect(idx)}
            />
          ))}
        </>
      )}
      {otherFiles.length > 0 && (
        <>
          <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wider border-t border-neutral-700">
            All Matches
          </div>
          {otherFiles.map((result, idx) => {
            const globalIndex = recentFiles.length + idx
            return (
              <FileOption
                key={result.path}
                path={result.path}
                isRecent={result.isRecent}
                isHighlighted={selectedIndex === globalIndex}
                onSelect={() => onSelect(globalIndex)}
              />
            )
          })}
        </>
      )}
    </div>
  )
}
