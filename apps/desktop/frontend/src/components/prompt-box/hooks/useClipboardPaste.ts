import { useCallback } from 'react'
import { toast } from 'sonner'
import { validateImageFile, isImageFile } from '../utils/validateImage'

interface UseClipboardPasteProps {
  onPasteImages: (files: File[]) => void
  maxImageSize?: number
  disabled?: boolean
}

export function useClipboardPaste({
  onPasteImages,
  maxImageSize,
  disabled,
}: UseClipboardPasteProps) {
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return

      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file && isImageFile(file)) {
            const validation = validateImageFile(file, maxImageSize)
            if (validation.valid) {
              imageFiles.push(file)
            } else if (validation.error) {
              toast.error(validation.error)
            }
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        onPasteImages(imageFiles)
      }
    },
    [disabled, maxImageSize, onPasteImages]
  )

  return { handlePaste }
}
