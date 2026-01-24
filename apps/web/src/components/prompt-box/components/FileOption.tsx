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
    <button
      type="button"
      role="option"
      aria-selected={isHighlighted}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
        isHighlighted ? 'bg-blue-500/20 text-blue-300' : 'text-neutral-300 hover:bg-neutral-800'
      }`}
    >
      <FileText className="h-4 w-4 flex-shrink-0 text-neutral-500" />
      <span className="flex-1 truncate">
        {directory && <span className="text-neutral-500">{directory}/</span>}
        <span className="font-medium">{filename}</span>
      </span>
      {isRecent && <Clock className="h-3 w-3 text-neutral-500" />}
    </button>
  )
}
