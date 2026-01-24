import Fuse from 'fuse.js'
import type { FileSearchOptions, FileSearchResult } from '../PromptBox.types'

const defaultOptions: FileSearchOptions = {
  threshold: 0.4,
  limit: 10,
  includeMatches: true,
}

export function searchFiles(
  query: string,
  files: string[],
  options: FileSearchOptions = {}
): FileSearchResult[] {
  const opts = { ...defaultOptions, ...options }

  if (!query.trim()) {
    return files.slice(0, opts.limit).map((path) => ({
      path,
      score: 0,
    }))
  }

  const fuse = new Fuse(files, {
    threshold: opts.threshold,
    includeScore: true,
    includeMatches: opts.includeMatches,
  })

  const results = fuse.search(query, { limit: opts.limit ?? 10 })

  return results.map((result) => ({
    path: result.item,
    score: result.score !== undefined ? result.score : 0,
    matches: opts.includeMatches
      ? result.matches?.map((m) => ({ indices: m.indices as [number, number][] }))
      : undefined,
  }))
}

export function sortByRecent(
  files: string[],
  recentFiles: string[],
  limit: number = 10
): Array<{ path: string; isRecent: boolean }> {
  const recentSet = new Set(recentFiles)
  const recent: Array<{ path: string; isRecent: boolean }> = []
  const other: Array<{ path: string; isRecent: boolean }> = []

  for (const path of files) {
    if (recentSet.has(path)) {
      recent.push({ path, isRecent: true })
    } else {
      other.push({ path, isRecent: false })
    }
  }

  // Sort recent by their order in recentFiles (most recent first)
  recent.sort((a, b) => recentFiles.indexOf(a.path) - recentFiles.indexOf(b.path))

  return [...recent, ...other].slice(0, limit)
}
