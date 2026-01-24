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
    ? 'text-red-400'
    : isWarning
      ? 'text-yellow-400'
      : 'text-neutral-500'

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-700 text-xs">
      <div className="flex items-center gap-3">
        <span className={charColorClass}>
          {charCount.toLocaleString()} chars
        </span>
        {imageCount > 0 && (
          <span className="text-neutral-500">
            {imageCount} {imageCount === 1 ? 'image' : 'images'}
          </span>
        )}
        <span className="text-neutral-600">@ files</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="px-2 py-1 text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="px-2 py-1 text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
