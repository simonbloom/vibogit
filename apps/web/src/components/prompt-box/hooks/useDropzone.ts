import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { validateImageFile, isImageFile } from '../utils/validateImage'

interface UseDropzoneProps {
  onDrop: (files: File[]) => void
  maxImageSize?: number
  disabled?: boolean
}

export function useDropzone({ onDrop, maxImageSize, disabled }: UseDropzoneProps) {
  const [isActive, setIsActive] = useState(false)
  const dragCounterRef = useRef(0)

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return

      dragCounterRef.current++
      if (e.dataTransfer.types.includes('Files')) {
        setIsActive(true)
      }
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsActive(false)
    }
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
    },
    [disabled]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsActive(false)
      dragCounterRef.current = 0

      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      const imageFiles = files.filter(isImageFile)

      if (imageFiles.length === 0 && files.length > 0) {
        toast.error('Only images allowed. Supported: PNG, JPG, GIF, WEBP')
        return
      }

      const validFiles: File[] = []
      for (const file of imageFiles) {
        const validation = validateImageFile(file, maxImageSize)
        if (validation.valid) {
          validFiles.push(file)
        } else if (validation.error) {
          toast.error(validation.error)
        }
      }

      if (validFiles.length > 0) {
        onDrop(validFiles)
      }
    },
    [disabled, maxImageSize, onDrop]
  )

  useEffect(() => {
    return () => {
      dragCounterRef.current = 0
    }
  }, [])

  return {
    isActive,
    handlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  }
}
