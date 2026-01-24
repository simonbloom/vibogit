import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'

interface RichTextareaProps {
  value: string
  onChange: (value: string) => void
  onMentionStart: (searchTerm: string, position: { x: number; y: number }) => void
  onMentionCancel: () => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  onFocus?: () => void
  onBlur?: () => void
  onPaste?: (e: React.ClipboardEvent) => void
  placeholder?: string
  maxLength?: number
  minHeight?: number
  maxHeight?: number
  ariaLabel?: string
  disabled?: boolean
}

export interface RichTextareaRef {
  focus: () => void
  blur: () => void
  getSelectionStart: () => number
  setSelectionRange: (start: number, end: number) => void
}

export const RichTextarea = forwardRef<RichTextareaRef, RichTextareaProps>(
  function RichTextarea(
    {
      value,
      onChange,
      onMentionStart,
      onMentionCancel,
      onKeyDown,
      onFocus,
      onBlur,
      onPaste,
      placeholder = 'Draft your prompt here... (use @ to reference files)',
      maxLength,
      minHeight = 100,
      maxHeight = 300,
      ariaLabel = 'Compose prompt',
      disabled = false,
    },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      getSelectionStart: () => textareaRef.current?.selectionStart ?? 0,
      setSelectionRange: (start: number, end: number) => {
        textareaRef.current?.setSelectionRange(start, end)
      },
    }))

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
        onChange(newValue)

        // Detect @ mention trigger
        const cursorPos = e.target.selectionStart
        const textBeforeCursor = newValue.slice(0, cursorPos)
        const match = textBeforeCursor.match(/@(\w*)$/)

        if (match) {
          // Calculate approximate position for dropdown
          const textarea = e.target
          const rect = textarea.getBoundingClientRect()

          // Simple positioning - place below the textarea
          // In a more advanced implementation, we'd calculate the exact position
          // of the @ character using a hidden span or canvas measurement
          const position = {
            x: 0,
            y: rect.height + 4,
          }

          onMentionStart(match[1], position)
        }
      },
      [onChange, onMentionStart]
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Let parent handle keyboard events first
        onKeyDown?.(e)

        // If not prevented, handle escape to cancel mention
        if (!e.defaultPrevented && e.key === 'Escape') {
          onMentionCancel()
        }
      },
      [onKeyDown, onMentionCancel]
    )

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onPaste={onPaste}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        aria-label={ariaLabel}
        className="w-full bg-transparent text-neutral-200 placeholder-neutral-500 resize-none outline-none"
        style={{ minHeight, maxHeight }}
      />
    )
  }
)
