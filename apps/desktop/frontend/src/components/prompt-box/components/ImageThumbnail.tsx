import { Button } from '@/components/ui/button'
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
    <div className="relative group w-32 rounded-md border border-border bg-muted overflow-hidden">
      {image.status === 'error' ? (
        <div className="h-20 flex items-center justify-center bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
      ) : (
        <div className="relative h-20">
          <img
            src={image.preview}
            alt={image.filename}
            className="h-full w-full object-cover"
          />
          {image.status === 'uploading' && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
              <div className="text-xs text-foreground font-medium">{image.progress}%</div>
            </div>
          )}
        </div>
      )}

      <div className="p-1.5">
        <p className="text-xs text-foreground truncate" title={image.filename}>
          {image.filename}
        </p>
        {image.status === 'error' && image.error && (
          <p className="text-xs text-destructive truncate" title={image.error}>
            {image.error}
          </p>
        )}
      </div>

      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {image.status === 'error' && onRetry && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 bg-background/80"
            onClick={onRetry}
            aria-label="Retry upload"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background/80 hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remove ${image.filename}`}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
