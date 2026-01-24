import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'prompt-box-recent-files'
const MAX_RECENT = 20

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setRecentFiles(JSON.parse(stored))
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const addToRecent = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const filtered = prev.filter((p) => p !== path)
      const updated = [path, ...filtered].slice(0, MAX_RECENT)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // Ignore localStorage errors
      }
      return updated
    })
  }, [])

  const clearRecent = useCallback(() => {
    setRecentFiles([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  return { recentFiles, addToRecent, clearRecent }
}
