import { ImageThumbnail } from './ImageThumbnail'
import type { PromptImage } from '../PromptBox.types'

interface ImagePreviewGridProps {
  images: PromptImage[]
  onRemove: (id: string) => void
  onRetry?: (image: PromptImage) => void
}

export function ImagePreviewGrid({ images, onRemove, onRetry }: ImagePreviewGridProps) {
  if (images.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 p-2 border-t border-neutral-700">
      {images.map((image) => (
        <ImageThumbnail
          key={image.id}
          image={image}
          onRemove={() => onRemove(image.id)}
          onRetry={onRetry ? () => onRetry(image) : undefined}
        />
      ))}
    </div>
  )
}
