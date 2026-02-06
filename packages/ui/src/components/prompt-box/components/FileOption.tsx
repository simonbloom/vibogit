import { Button } from '@/components/ui/button'
import { FileText, Clock } from 'lucide-react'

interface FileOptionProps {
  path: string
  isRecent: boolean
  isHighlighted: boolean
  onSelect: () => void
}

export function FileOption({ path, isRecent, isHighlighted, onSelect }: FileOptionProps) {
  const filename = path.split('/').pop() || path
  const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''

  return (
    <Button
      variant="ghost"
      role="option"
      aria-selected={isHighlighted}
      onClick={onSelect}
      className={`flex w-full items-center justify-start gap-2 px-3 py-1.5 h-auto rounded-none ${
        isHighlighted ? 'bg-primary/20 text-primary' : ''
      }`}
    >
      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-left">
        {directory && <span className="text-muted-foreground">{directory}/</span>}
        <span className="font-medium">{filename}</span>
      </span>
      {isRecent && <Clock className="h-3 w-3 text-muted-foreground" />}
    </Button>
  )
}
