import { useCallback, useRef, useEffect } from 'react'
import { isTauri } from '@/platform'
import type { PromptImage } from '../PromptBox.types'

interface UseImageUploadProps {
  uploadEndpoint?: string
  onImageUpload?: (file: File) => Promise<{ url: string; id: string }>
  onAddImage: (image: PromptImage, cursorPosition: number) => void
  onUpdateImage: (id: string, updates: Partial<PromptImage>) => void
  getNextReferenceNumber: () => number
  getCursorPosition: () => number
}

export function useImageUpload({
  uploadEndpoint,
  onImageUpload,
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

      // In Tauri mode, skip upload -- images are local files
      if (isTauri()) {
        onUpdateImage(tempId, {
          url: preview,
          status: 'uploaded',
          progress: 100,
        })
        return
      }

      try {
        let result: { url: string; id: string }

        if (onImageUpload) {
          result = await onImageUpload(file)
        } else if (uploadEndpoint) {
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            throw new Error('Upload failed')
          }

          result = await response.json()
        } else {
          // No upload configured, just use local preview
          result = { url: preview, id: tempId }
        }

        onUpdateImage(tempId, {
          id: result.id,
          url: result.url,
          status: 'uploaded',
          progress: 100,
        })
      } catch (error) {
        onUpdateImage(tempId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed',
        })
      }
    },
    [uploadEndpoint, onImageUpload, onAddImage, onUpdateImage, getNextReferenceNumber, getCursorPosition]
  )

  const retryUpload = useCallback(
    async (image: PromptImage, file: File) => {
      onUpdateImage(image.id, { status: 'uploading', progress: 0, error: undefined })

      try {
        let result: { url: string; id: string }

        if (onImageUpload) {
          result = await onImageUpload(file)
        } else if (uploadEndpoint) {
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            throw new Error('Upload failed')
          }

          result = await response.json()
        } else {
          result = { url: image.preview, id: image.id }
        }

        onUpdateImage(image.id, {
          url: result.url,
          status: 'uploaded',
          progress: 100,
        })
      } catch (error) {
        onUpdateImage(image.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed',
        })
      }
    },
    [uploadEndpoint, onImageUpload, onUpdateImage]
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
