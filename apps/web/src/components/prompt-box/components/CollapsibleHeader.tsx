import { ChevronDown } from 'lucide-react'

interface CollapsibleHeaderProps {
  isExpanded: boolean
  onToggle: () => void
  label?: string
}

export function CollapsibleHeader({
  isExpanded,
  onToggle,
  label = 'Prompt',
}: CollapsibleHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800/50 transition-colors"
      aria-expanded={isExpanded}
    >
      <ChevronDown
        className={`h-4 w-4 transition-transform duration-200 ${
          isExpanded ? 'rotate-180' : ''
        }`}
      />
      <span>{label}</span>
    </button>
  )
}
