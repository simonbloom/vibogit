import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useDaemon } from '@/lib/daemon-context'
import type { Skill } from '@vibogit/shared'

interface UseSkillAutocompleteProps {
  onSelect: (skill: Skill) => void
}

export function useSkillAutocomplete({ onSelect }: UseSkillAutocompleteProps) {
  const { state, send } = useDaemon()
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [skills, setSkills] = useState<Skill[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const isConnected = state.connection === 'connected'

  // Fetch skills from daemon on mount and when connection changes
  useEffect(() => {
    if (!isConnected) {
      setSkills([])
      return
    }

    const fetchSkills = async () => {
      try {
        const response = await send<{ skills: Skill[] }>('list-skills')
        setSkills(response.skills || [])
      } catch (err) {
        console.error('[Skills] Failed to fetch skills:', err)
        setSkills([])
      }
    }

    fetchSkills()
  }, [isConnected, send])

  const results = useMemo((): Skill[] => {
    if (!searchTerm) {
      return skills.slice(0, 10)
    }

    const term = searchTerm.toLowerCase()
    return skills
      .filter(
        (skill) =>
          skill.name.toLowerCase().includes(term) ||
          skill.description.toLowerCase().includes(term)
      )
      .slice(0, 10)
  }, [searchTerm, skills])

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
      onSelect(results[selectedIndex])
      close()
    }
  }, [results, selectedIndex, onSelect, close])

  const selectItem = useCallback(
    (index: number) => {
      if (results[index]) {
        onSelect(results[index])
        close()
      }
    },
    [results, onSelect, close]
  )

  return {
    isOpen,
    isConnected,
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
