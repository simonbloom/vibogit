import { Button } from '@/components/ui/button'
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
    <Button
      variant="ghost"
      onClick={onToggle}
      className="flex w-full items-center justify-start gap-2 px-3 py-2 h-auto rounded-none"
      aria-expanded={isExpanded}
    >
      <ChevronDown
        className={`h-4 w-4 transition-transform duration-200 ${
          isExpanded ? 'rotate-180' : ''
        }`}
      />
      <span>{label}</span>
    </Button>
  )
}
