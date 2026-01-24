import type { PromptBoxState } from '../PromptBox.types'

interface BuildCopyTextOptions {
  imageBasePath?: string
}

export function buildCopyText(state: PromptBoxState, options: BuildCopyTextOptions = {}): string {
  let output = state.text

  // Replace [image N] references with file paths
  state.images.forEach((img) => {
    const reference = `[image ${img.referenceNumber}]`
    // Use filePath if available, or construct from basePath + filename, or just filename
    let replacement = img.filename
    if (img.filePath) {
      replacement = img.filePath
    } else if (options.imageBasePath) {
      const basePath = options.imageBasePath.endsWith('/') 
        ? options.imageBasePath 
        : options.imageBasePath + '/'
      replacement = basePath + img.filename
    }
    output = output.replace(reference, replacement)
  })

  if (state.files.length > 0) {
    output += '\n\n---\nReferenced Files:\n'
    state.files.forEach((file) => {
      output += `- ${file.path}\n`
    })
  }

  return output.trim()
}
