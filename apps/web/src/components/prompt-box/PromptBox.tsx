'use client'

import { useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { CollapsibleHeader } from './components/CollapsibleHeader'
import { FileChip } from './components/FileChip'
import { AutocompletePanel } from './components/AutocompletePanel'
import { DropzoneOverlay } from './components/DropzoneOverlay'
import { ImagePreviewGrid } from './components/ImagePreviewGrid'
import { StatusBar } from './components/StatusBar'
import { usePromptBox } from './hooks/usePromptBox'
import { useAutocomplete } from './hooks/useAutocomplete'
import { useDropzone } from './hooks/useDropzone'
import { useImageUpload } from './hooks/useImageUpload'
import { useClipboardPaste } from './hooks/useClipboardPaste'
import { useRecentFiles } from './hooks/useRecentFiles'
import { buildCopyText } from './utils/buildCopyText'
import type { PromptBoxProps, PromptImage } from './PromptBox.types'

const DEFAULT_MAX_LENGTH = 10000
const DEFAULT_MAX_FILES = 10
const DEFAULT_MAX_IMAGES = 5
const DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

export function PromptBox({
  defaultValue,
  placeholder = 'Draft your prompt here... (use @ to reference files)',
  maxLength = DEFAULT_MAX_LENGTH,
  projectFiles = [],
  recentFiles: externalRecentFiles,
  onFileAccess,
  maxFiles = DEFAULT_MAX_FILES,
  maxImages = DEFAULT_MAX_IMAGES,
  maxImageSize = DEFAULT_MAX_IMAGE_SIZE,
  uploadEndpoint,
  onImageUpload,
  imageBasePath,
  onSubmit,
  onCopy,
  onClear,
  defaultExpanded = false,
  minHeight = 100,
  maxHeight = 300,
  ariaLabel = 'Compose prompt',
}: PromptBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { recentFiles: localRecentFiles, addToRecent } = useRecentFiles()
  const recentFiles = externalRecentFiles || localRecentFiles

  const {
    state,
    setText,
    setCursor,
    addFile,
    removeFile,
    addImage,
    updateImage,
    removeImage,
    setExpanded,
    setFocused,
    clear,
    getPromptData,
  } = usePromptBox({ defaultValue, defaultExpanded })

  // Sync cursor position after image insertion
  useEffect(() => {
    if (textareaRef.current && state.cursorPosition !== undefined) {
      textareaRef.current.setSelectionRange(state.cursorPosition, state.cursorPosition)
    }
  }, [state.cursorPosition])

  const handleFileSelect = useCallback(
    (path: string) => {
      if (state.files.length >= maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`)
        return
      }
      if (state.files.some((f) => f.path === path)) {
        toast.error('File already added')
        return
      }

      // Find the @mention to replace
      const cursorPos = textareaRef.current?.selectionStart ?? state.text.length
      const textBeforeCursor = state.text.slice(0, cursorPos)
      const atMatch = textBeforeCursor.match(/@[\w.-]*$/)
      
      let replaceStart = cursorPos
      let replaceEnd = cursorPos
      if (atMatch) {
        replaceStart = cursorPos - atMatch[0].length
        replaceEnd = cursorPos
      }

      addFile(path, replaceStart, replaceEnd)
      addToRecent(path)
      onFileAccess?.(path)

      // Focus back on textarea
      textareaRef.current?.focus()
    },
    [state.files, state.text, maxFiles, addFile, addToRecent, onFileAccess]
  )

  const autocomplete = useAutocomplete({
    projectFiles,
    recentFiles,
    onSelect: handleFileSelect,
  })

  const getNextReferenceNumber = useCallback(() => {
    const maxRef = state.images.reduce((max, img) => Math.max(max, img.referenceNumber), 0)
    return maxRef + 1
  }, [state.images])

  const getCursorPosition = useCallback(() => {
    return textareaRef.current?.selectionStart ?? state.text.length
  }, [state.text.length])

  const { uploadImage, cleanupBlobUrl } = useImageUpload({
    uploadEndpoint,
    onImageUpload,
    onAddImage: addImage,
    onUpdateImage: updateImage,
    getNextReferenceNumber,
    getCursorPosition,
  })

  const handleImageDrop = useCallback(
    (files: File[]) => {
      const remaining = maxImages - state.images.length
      if (remaining <= 0) {
        toast.error(`Maximum ${maxImages} images allowed`)
        return
      }
      const filesToUpload = files.slice(0, remaining)
      filesToUpload.forEach(uploadImage)
    },
    [maxImages, state.images.length, uploadImage]
  )

  const dropzone = useDropzone({
    onDrop: handleImageDrop,
    maxImageSize,
  })

  const { handlePaste } = useClipboardPaste({
    onPasteImages: handleImageDrop,
    maxImageSize,
  })

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setText(value)

      // Check for @ mention trigger
      const cursorPos = e.target.selectionStart
      const textBeforeCursor = value.slice(0, cursorPos)
      const match = textBeforeCursor.match(/@(\w*)$/)

      if (match) {
        const rect = e.target.getBoundingClientRect()
        autocomplete.open(match[1], { x: 0, y: rect.height })
      } else if (autocomplete.isOpen) {
        autocomplete.close()
      }
    },
    [setText, autocomplete]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Autocomplete navigation
      if (autocomplete.isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          autocomplete.moveDown()
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          autocomplete.moveUp()
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          autocomplete.selectCurrent()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          autocomplete.close()
          return
        }
      }

      // Submit with Cmd/Ctrl + Enter
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
        return
      }

      // Copy with Cmd/Ctrl + Shift + C
      if (e.key === 'c' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        handleCopy()
        return
      }

      // Clear with Cmd/Ctrl + Shift + X
      if (e.key === 'x' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        handleClear()
        return
      }

      // Escape to collapse
      if (e.key === 'Escape' && !autocomplete.isOpen) {
        setExpanded(false)
        textareaRef.current?.blur()
      }
    },
    [autocomplete, setExpanded]
  )

  const handleSend = useCallback(() => {
    if (!state.text.trim() && state.files.length === 0 && state.images.length === 0) {
      return
    }
    onSubmit(getPromptData())
  }, [state.text, state.files, state.images, onSubmit, getPromptData])

  const handleCopy = useCallback(async () => {
    const text = buildCopyText(state, { imageBasePath })
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard!')
      onCopy?.(text)
    } catch {
      toast.error("Couldn't copy to clipboard. Check permissions.")
    }
  }, [state, onCopy, imageBasePath])

  const handleClear = useCallback(() => {
    // Cleanup blob URLs
    state.images.forEach((img) => cleanupBlobUrl(img.preview))
    clear()
    onClear?.()
  }, [state.images, cleanupBlobUrl, clear, onClear])

  const handleRemoveImage = useCallback(
    (id: string) => {
      const image = state.images.find((img) => img.id === id)
      if (image) {
        cleanupBlobUrl(image.preview)
      }
      removeImage(id)
    },
    [state.images, cleanupBlobUrl, removeImage]
  )

  const handleFocus = useCallback(() => {
    setFocused(true)
    setExpanded(true)
  }, [setFocused, setExpanded])

  const handleBlur = useCallback(() => {
    setFocused(false)
  }, [setFocused])

  const canSend = state.text.trim().length > 0 || state.files.length > 0 || state.images.length > 0

  return (
    <div
      ref={containerRef}
      className="relative rounded-lg border-[3px] border-black bg-card"
      {...dropzone.handlers}
    >
      <CollapsibleHeader
        isExpanded={state.isExpanded}
        onToggle={() => setExpanded(!state.isExpanded)}
      />

      {state.isExpanded && (
        <>
          <div className="relative">
            <DropzoneOverlay isActive={dropzone.isActive} />

            <div className="p-3">
              {/* File chips */}
              {state.files.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {state.files.map((file) => (
                    <FileChip
                      key={file.path}
                      path={file.path}
                      onRemove={() => removeFile(file.path)}
                    />
                  ))}
                </div>
              )}

              {/* Textarea */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={state.text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onPaste={handlePaste}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  aria-label={ariaLabel}
                  className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none border-0"
                  style={{ minHeight, maxHeight }}
                />

                <AutocompletePanel
                  isOpen={autocomplete.isOpen}
                  results={autocomplete.results}
                  selectedIndex={autocomplete.selectedIndex}
                  position={autocomplete.position}
                  onSelect={autocomplete.selectItem}
                />
              </div>
            </div>

            {/* Image previews */}
            <ImagePreviewGrid
              images={state.images}
              onRemove={handleRemoveImage}
            />
          </div>

          <StatusBar
            charCount={state.text.length}
            imageCount={state.images.length}
            maxLength={maxLength}
            onClear={handleClear}
            onSend={handleSend}
            onCopy={handleCopy}
            canSend={canSend}
          />
        </>
      )}
    </div>
  )
}
