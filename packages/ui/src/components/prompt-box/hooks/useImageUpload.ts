import { useCallback, useRef, useEffect } from 'react'
import type { PromptImage } from '../PromptBox.types'

interface UseImageUploadProps {
  onAddImage: (image: PromptImage, cursorPosition: number) => void
  onUpdateImage: (id: string, updates: Partial<PromptImage>) => void
  getNextReferenceNumber: () => number
  getCursorPosition: () => number
}

export function useImageUpload({
  onAddImage,
  onUpdateImage,
  getNextReferenceNumber,
  getCursorPosition,
}: UseImageUploadProps) {
  const blobUrlsRef = useRef<Set<string>>(new Set())

  const uploadImage = useCallback(
    async (file: File) => {
      const tempId = crypto.randomUUID()
      const preview = URL.createObjectURL(file)
      blobUrlsRef.current.add(preview)
      const referenceNumber = getNextReferenceNumber()
      const cursorPosition = getCursorPosition()

      // Try to get file path if available (File System Access API)
      const filePath = (file as File & { path?: string }).path

      const image: PromptImage = {
        id: tempId,
        filename: file.name,
        filePath,
        preview,
        url: null,
        status: 'uploading',
        progress: 0,
        referenceNumber,
      }

      onAddImage(image, cursorPosition)

      onUpdateImage(tempId, {
        id: tempId,
        url: preview,
        status: 'uploaded',
        progress: 100,
      })
    },
    [onAddImage, onUpdateImage, getNextReferenceNumber, getCursorPosition]
  )

  const retryUpload = useCallback(
    async (image: PromptImage, file: File) => {
      onUpdateImage(image.id, { status: 'uploading', progress: 0, error: undefined })

      const preview = URL.createObjectURL(file)
      blobUrlsRef.current.add(preview)
      onUpdateImage(image.id, {
        url: preview,
        preview,
        status: 'uploaded',
        progress: 100,
      })
    },
    [onUpdateImage]
  )

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      blobUrlsRef.current.clear()
    }
  }, [])

  const cleanupBlobUrl = useCallback((url: string) => {
    if (blobUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url)
      blobUrlsRef.current.delete(url)
    }
  }, [])

  return { uploadImage, retryUpload, cleanupBlobUrl }
}
