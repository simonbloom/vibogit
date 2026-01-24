/** Image status during upload lifecycle */
export type ImageStatus = 'uploading' | 'uploaded' | 'error'

/** Single image in the prompt */
export interface PromptImage {
  id: string
  filename: string
  filePath?: string // original file path on disk (if available)
  preview: string // blob URL for local preview
  url: string | null // remote URL after upload
  status: ImageStatus
  progress: number // 0-100
  error?: string
  referenceNumber: number // image number for [image N] reference
}

/** Single file reference in the prompt */
export interface PromptFile {
  path: string
  addedAt: Date
}

/** Data returned on submit */
export interface PromptData {
  text: string
  files: string[]
  images: Array<{ id: string; url: string; filename: string; filePath?: string; referenceNumber: number }>
}

/** Autocomplete state */
export interface AutocompleteState {
  isOpen: boolean
  searchTerm: string
  selectedIndex: number
  results: Array<{ path: string; isRecent: boolean }>
  position: { x: number; y: number }
}

/** Internal state for PromptBox */
export interface PromptBoxState {
  text: string
  cursorPosition: number
  files: PromptFile[]
  images: PromptImage[]
  isExpanded: boolean
  isFocused: boolean
  isDropzoneActive: boolean
  autocomplete: AutocompleteState
}

/** Props for PromptBox component */
export interface PromptBoxProps {
  // Core
  defaultValue?: string
  placeholder?: string
  /** Maximum character length. Default: 10,000 */
  maxLength?: number

  // File references
  /** All available project files for @ mentions */
  projectFiles: string[]
  /** Prioritized recent files shown first */
  recentFiles?: string[]
  /** Callback when a file is accessed */
  onFileAccess?: (path: string) => void
  /** Maximum file references allowed. Default: 10 */
  maxFiles?: number

  // Images
  /** Maximum images allowed. Default: 5 */
  maxImages?: number
  /** Maximum image size in bytes. Default: 10MB */
  maxImageSize?: number
  /** POST endpoint for image uploads */
  uploadEndpoint?: string
  /** Custom upload handler */
  onImageUpload?: (file: File) => Promise<{ url: string; id: string }>
  /** Base path for images (used when copying, e.g., '/Users/you/Desktop/') */
  imageBasePath?: string

  // Actions
  /** Called when user submits the prompt */
  onSubmit: (data: PromptData) => void
  /** Called when user copies the prompt */
  onCopy?: (text: string) => void
  /** Called when user clears the prompt */
  onClear?: () => void

  // Appearance
  /** Start expanded. Default: false */
  defaultExpanded?: boolean
  /** Minimum height in pixels */
  minHeight?: number
  /** Maximum height in pixels */
  maxHeight?: number

  // Accessibility
  /** Aria label for the prompt box */
  ariaLabel?: string
}

/** File search result with match info */
export interface FileSearchResult {
  path: string
  score: number
  matches?: Array<{ indices: [number, number][] }>
}

/** Options for file search */
export interface FileSearchOptions {
  threshold?: number // Default: 0.4
  limit?: number // Default: 10
  includeMatches?: boolean
}
