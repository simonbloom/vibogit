import { X, RefreshCw, AlertCircle } from 'lucide-react'
import type { PromptImage } from '../PromptBox.types'

interface ImageThumbnailProps {
  image: PromptImage
  onRemove: () => void
  onRetry?: () => void
}

export function ImageThumbnail({ image, onRemove, onRetry }: ImageThumbnailProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="relative group w-32 rounded-md border border-neutral-700 bg-neutral-800 overflow-hidden">
      {image.status === 'error' ? (
        <div className="h-20 flex items-center justify-center bg-red-500/10">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
      ) : (
        <div className="relative h-20">
          <img
            src={image.preview}
            alt={image.filename}
            className="h-full w-full object-cover"
          />
          {image.status === 'uploading' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-xs text-white font-medium">{image.progress}%</div>
            </div>
          )}
        </div>
      )}

      <div className="p-1.5">
        <p className="text-xs text-neutral-300 truncate" title={image.filename}>
          {image.filename}
        </p>
        {image.status === 'error' && image.error && (
          <p className="text-xs text-red-400 truncate" title={image.error}>
            {image.error}
          </p>
        )}
      </div>

      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {image.status === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="p-1 rounded bg-neutral-900/80 text-neutral-300 hover:text-blue-400"
            aria-label="Retry upload"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded bg-neutral-900/80 text-neutral-300 hover:text-red-400"
          aria-label={`Remove ${image.filename}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
