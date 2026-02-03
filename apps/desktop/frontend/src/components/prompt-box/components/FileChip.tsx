import { Button } from '@/components/ui/button'
import { X, FileText, AlertTriangle } from 'lucide-react'

interface FileChipProps {
  path: string
  onRemove: () => void
  onClick?: () => void
  hasWarning?: boolean
}

export function FileChip({ path, onRemove, onClick, hasWarning }: FileChipProps) {
  const filename = path.split('/').pop() || path

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
        hasWarning
          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
      }`}
      title={path}
    >
      {hasWarning ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <FileText className="h-3 w-3" />
      )}
      <span
        className={onClick ? 'cursor-pointer hover:underline' : ''}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      >
        {filename}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4 p-0 hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label={`Remove ${filename}`}
      >
        <X className="h-3 w-3" />
      </Button>
    </span>
  )
}
