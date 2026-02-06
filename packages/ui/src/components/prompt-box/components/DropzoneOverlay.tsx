import { ImageIcon } from 'lucide-react'

interface DropzoneOverlayProps {
  isActive: boolean
}

export function DropzoneOverlay({ isActive }: DropzoneOverlayProps) {
  if (!isActive) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center rounded-md border-2 border-dashed border-blue-500 bg-blue-500/10 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 text-blue-300">
        <ImageIcon className="h-8 w-8" />
        <p className="text-sm font-medium">Drop images here</p>
        <p className="text-xs text-blue-400">PNG, JPG, GIF, WEBP up to 10MB</p>
      </div>
    </div>
  )
}
