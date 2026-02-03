const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateImageFile(file: File, maxSize: number = MAX_SIZE_BYTES): ValidationResult {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `${file.name} is not a supported image type. Supported: PNG, JPG, GIF, WEBP`,
    }
  }

  if (file.size > maxSize) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    const maxMB = (maxSize / (1024 * 1024)).toFixed(0)
    return {
      valid: false,
      error: `${file.name} (${sizeMB} MB) exceeds ${maxMB}MB limit`,
    }
  }

  return { valid: true }
}

export function isImageFile(file: File): boolean {
  return ALLOWED_TYPES.includes(file.type)
}
