'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { isTauri } from '@/platform'
import { CollapsibleHeader } from './components/CollapsibleHeader'
import { FileChip } from './components/FileChip'
import { AutocompletePanel } from './components/AutocompletePanel'
import { SkillAutocompletePanel } from './components/SkillAutocompletePanel'
import { DropzoneOverlay } from './components/DropzoneOverlay'
import { ImagePreviewGrid } from './components/ImagePreviewGrid'
import { StatusBar } from './components/StatusBar'
import { usePromptBox } from './hooks/usePromptBox'
import { useAutocomplete } from './hooks/useAutocomplete'
import { useSkillAutocomplete } from './hooks/useSkillAutocomplete'
import { useDropzone } from './hooks/useDropzone'
import { useImageUpload } from './hooks/useImageUpload'
import { useClipboardPaste } from './hooks/useClipboardPaste'
import { useRecentFiles } from './hooks/useRecentFiles'
import { buildCopyText } from './utils/buildCopyText'
import type { PromptBoxProps, PromptImage } from './PromptBox.types'
import type { Skill } from '@vibogit/shared'

const DEFAULT_MAX_LENGTH = 10000
const DEFAULT_MAX_FILES = 10
const DEFAULT_MAX_IMAGES = 5
const DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

export function PromptBox({
  defaultValue,
  placeholder = 'Draft your prompt here... (use @ for files, / for skills)',
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
  defaultExpanded = true,
  terminalName,
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

  // Auto-resize textarea based on content
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to measure true scrollHeight
    textarea.style.height = 'auto'
    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight))
    textarea.style.height = `${newHeight}px`

    // Enable scroll only when at max height
    textarea.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden'
  }, [minHeight, maxHeight])

  // Adjust height on mount and when text changes
  useEffect(() => {
    adjustHeight()
  }, [state.text, adjustHeight])

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

  const handleSkillSelect = useCallback(
    (skill: Skill) => {
      // Find the /mention to replace
      const cursorPos = textareaRef.current?.selectionStart ?? state.text.length
      const textBeforeCursor = state.text.slice(0, cursorPos)
      const slashMatch = textBeforeCursor.match(/\/[\w-]*$/)

      let replaceStart = cursorPos
      let replaceEnd = cursorPos
      if (slashMatch) {
        replaceStart = cursorPos - slashMatch[0].length
        replaceEnd = cursorPos
      }

      // Insert the skill reference phrase
      const insertText = `Please use ${skill.name} skill to `
      const newText =
        state.text.slice(0, replaceStart) + insertText + state.text.slice(replaceEnd)
      setText(newText)

      // Set cursor position after inserted text
      const newCursorPos = replaceStart + insertText.length
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
          textareaRef.current.focus()
        }
      }, 0)
    },
    [state.text, setText]
  )

  const skillAutocomplete = useSkillAutocomplete({
    onSelect: handleSkillSelect,
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
    disabled: isTauri(),
  })

  const { handlePaste: browserHandlePaste } = useClipboardPaste({
    onPasteImages: handleImageDrop,
    maxImageSize,
  })

  // Tauri: listen for native drag-drop events
  useEffect(() => {
    if (!isTauri()) return

    let unlisten: (() => void) | undefined

    const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']

    ;(async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview')
        const { convertFileSrc } = await import('@tauri-apps/api/core')

        unlisten = (await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === 'drop') {
            const paths = event.payload.paths || []
            const imagePaths = paths.filter((p: string) => {
              const ext = p.split('.').pop()?.toLowerCase() || ''
              return IMAGE_EXTENSIONS.includes(ext)
            })

            if (imagePaths.length === 0) return

            const remaining = maxImages - state.images.length
            if (remaining <= 0) {
              toast.error(`Maximum ${maxImages} images allowed`)
              return
            }

            const toAdd = imagePaths.slice(0, remaining)
            for (const filePath of toAdd) {
              const filename = filePath.split('/').pop() || 'image'
              const preview = convertFileSrc(filePath)
              const referenceNumber = getNextReferenceNumber()
              const cursorPosition = getCursorPosition()

              const image: PromptImage = {
                id: crypto.randomUUID(),
                filename,
                filePath,
                preview,
                url: preview,
                status: 'uploaded',
                progress: 100,
                referenceNumber,
              }
              addImage(image, cursorPosition)
            }
          }
        })) as unknown as () => void
      } catch (e) {
        console.error('Failed to set up Tauri drag-drop:', e)
      }
    })()

    return () => {
      unlisten?.()
    }
  }, [maxImages, state.images.length, getNextReferenceNumber, getCursorPosition, addImage])

  // Tauri: handle clipboard paste with CleanShot / save_clipboard_image
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (!isTauri()) {
        browserHandlePaste(e)
        return
      }

      const items = e.clipboardData?.items
      if (!items) return

      let hasImage = false
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          hasImage = true
          break
        }
      }

      if (!hasImage) return
      e.preventDefault()

      // Get config for CleanShot mode and imageBasePath
      let cleanShotMode = false
      let folder = ''
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const configResult = await invoke<{ config: { cleanShotMode?: boolean; imageBasePath?: string } }>('get_config')
        cleanShotMode = configResult.config.cleanShotMode ?? false
        folder = configResult.config.imageBasePath ?? ''
      } catch {
        // Fallback to defaults
      }

      const remaining = maxImages - state.images.length
      if (remaining <= 0) {
        toast.error(`Maximum ${maxImages} images allowed`)
        return
      }

      // Create blob preview from clipboard for display
      let blobPreview = ''
      let clipFilename = 'clipboard-image.png'
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) {
            blobPreview = URL.createObjectURL(file)
            clipFilename = file.name || clipFilename
          }
          break
        }
      }

      const referenceNumber = getNextReferenceNumber()
      const cursorPosition = getCursorPosition()
      const tempId = crypto.randomUUID()

      const image: PromptImage = {
        id: tempId,
        filename: clipFilename,
        preview: blobPreview,
        url: blobPreview,
        status: 'uploading',
        progress: 0,
        referenceNumber,
      }
      addImage(image, cursorPosition)

      try {
        const { invoke } = await import('@tauri-apps/api/core')
        let resolvedPath: string | null = null

        if (cleanShotMode) {
          const result = await invoke<{ path: string | null }>('find_recent_image', {
            folder,
            withinSecs: 5,
          })
          resolvedPath = result.path
        }

        if (!resolvedPath) {
          const result = await invoke<{ path: string }>('save_clipboard_image', { folder })
          resolvedPath = result.path
        }

        updateImage(tempId, {
          filePath: resolvedPath,
          filename: resolvedPath.split('/').pop() || clipFilename,
          status: 'uploaded',
          progress: 100,
        })
      } catch (error) {
        updateImage(tempId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to process clipboard image',
        })
      }
    },
    [browserHandlePaste, maxImages, state.images.length, getNextReferenceNumber, getCursorPosition, addImage, updateImage]
  )

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setText(value)

      const cursorPos = e.target.selectionStart
      const textBeforeCursor = value.slice(0, cursorPos)
      const rect = e.target.getBoundingClientRect()

      // Check for @ mention trigger (files)
      const atMatch = textBeforeCursor.match(/@(\w*)$/)
      if (atMatch) {
        autocomplete.open(atMatch[1], { x: 0, y: rect.height })
        if (skillAutocomplete.isOpen) skillAutocomplete.close()
        return
      } else if (autocomplete.isOpen) {
        autocomplete.close()
      }

      // Check for / mention trigger (skills)
      const slashMatch = textBeforeCursor.match(/\/([\w-]*)$/)
      if (slashMatch) {
        skillAutocomplete.open(slashMatch[1], { x: 0, y: rect.height })
        if (autocomplete.isOpen) autocomplete.close()
        return
      } else if (skillAutocomplete.isOpen) {
        skillAutocomplete.close()
      }
    },
    [setText, autocomplete, skillAutocomplete]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // File autocomplete navigation
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

      // Skill autocomplete navigation
      if (skillAutocomplete.isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          skillAutocomplete.moveDown()
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          skillAutocomplete.moveUp()
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          skillAutocomplete.selectCurrent()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          skillAutocomplete.close()
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
      if (e.key === 'Escape' && !autocomplete.isOpen && !skillAutocomplete.isOpen) {
        setExpanded(false)
        textareaRef.current?.blur()
      }
    },
    [autocomplete, skillAutocomplete, setExpanded]
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
        terminalName={terminalName}
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
                  className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none border-0 transition-[height] duration-150 ease-out"
                  style={{ minHeight, overflowY: 'hidden' }}
                />

                <AutocompletePanel
                  isOpen={autocomplete.isOpen}
                  results={autocomplete.results}
                  selectedIndex={autocomplete.selectedIndex}
                  position={autocomplete.position}
                  onSelect={autocomplete.selectItem}
                />

                <SkillAutocompletePanel
                  isOpen={skillAutocomplete.isOpen}
                  isConnected={skillAutocomplete.isConnected}
                  results={skillAutocomplete.results}
                  selectedIndex={skillAutocomplete.selectedIndex}
                  position={skillAutocomplete.position}
                  onSelect={skillAutocomplete.selectItem}
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
