import { Button } from '@/components/ui/button'

interface StatusBarProps {
  charCount: number
  imageCount: number
  maxLength: number
  onClear: () => void
  onSend: () => void
  onCopy: () => void
  canSend: boolean
}

export function StatusBar({
  charCount,
  imageCount,
  maxLength,
  onClear,
  onSend,
  onCopy,
  canSend,
}: StatusBarProps) {
  const percentage = (charCount / maxLength) * 100
  const isWarning = percentage >= 90 && percentage < 100
  const isError = percentage >= 100

  const charColorClass = isError
    ? 'text-destructive'
    : isWarning
      ? 'text-yellow-400'
      : 'text-muted-foreground'

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t-2 border-black text-xs">
      <div className="flex items-center gap-3">
        <span className={charColorClass}>
          {charCount.toLocaleString()} chars
        </span>
        {imageCount > 0 && (
          <span className="text-muted-foreground">
            {imageCount} {imageCount === 1 ? 'image' : 'images'}
          </span>
        )}
        <span className="text-muted-foreground/70">@ files</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Button variant="outline" size="sm" onClick={onCopy}>
          Copy
        </Button>
        <Button size="sm" onClick={onSend} disabled={!canSend}>
          Send
        </Button>
      </div>
    </div>
  )
}
