import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { searchFiles, sortByRecent } from '../utils/fileSearch'

interface AutocompleteResult {
  path: string
  isRecent: boolean
}

interface UseAutocompleteProps {
  projectFiles: string[]
  recentFiles: string[]
  onSelect: (path: string) => void
}

export function useAutocomplete({ projectFiles, recentFiles, onSelect }: UseAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const results = useMemo((): AutocompleteResult[] => {
    if (!searchTerm) {
      return sortByRecent(projectFiles, recentFiles, 10)
    }

    const searchResults = searchFiles(searchTerm, projectFiles, { limit: 10 })
    const paths = searchResults.map((r) => r.path)
    return sortByRecent(paths, recentFiles, 10)
  }, [searchTerm, projectFiles, recentFiles])

  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  const open = useCallback((term: string, pos: { x: number; y: number }) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      setSearchTerm(term)
      setPosition(pos)
      setIsOpen(true)
      setSelectedIndex(0)
    }, 100)
  }, [])

  const close = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    setIsOpen(false)
    setSearchTerm('')
    setSelectedIndex(0)
  }, [])

  const updateSearch = useCallback((term: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      setSearchTerm(term)
    }, 100)
  }, [])

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
  }, [results.length])

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
  }, [results.length])

  const selectCurrent = useCallback(() => {
    if (results[selectedIndex]) {
      onSelect(results[selectedIndex].path)
      close()
    }
  }, [results, selectedIndex, onSelect, close])

  const selectItem = useCallback(
    (index: number) => {
      if (results[index]) {
        onSelect(results[index].path)
        close()
      }
    },
    [results, onSelect, close]
  )

  return {
    isOpen,
    searchTerm,
    selectedIndex,
    position,
    results,
    open,
    close,
    updateSearch,
    moveUp,
    moveDown,
    selectCurrent,
    selectItem,
  }
}
