import { useReducer, useCallback } from 'react'
import type { PromptBoxState, PromptFile, PromptImage, PromptData } from '../PromptBox.types'

type Action =
  | { type: 'SET_TEXT'; payload: string }
  | { type: 'SET_CURSOR'; payload: number }
  | { type: 'ADD_FILE'; payload: { file: PromptFile; replaceStart: number; replaceEnd: number } }
  | { type: 'REMOVE_FILE'; payload: string }
  | { type: 'ADD_IMAGE'; payload: { image: PromptImage; cursorPosition: number } }
  | { type: 'UPDATE_IMAGE'; payload: { id: string; updates: Partial<PromptImage> } }
  | { type: 'REMOVE_IMAGE'; payload: string }
  | { type: 'SET_EXPANDED'; payload: boolean }
  | { type: 'SET_FOCUSED'; payload: boolean }
  | { type: 'SET_DROPZONE_ACTIVE'; payload: boolean }
  | { type: 'OPEN_AUTOCOMPLETE'; payload: { searchTerm: string; position: { x: number; y: number } } }
  | { type: 'UPDATE_AUTOCOMPLETE'; payload: { searchTerm: string; results: Array<{ path: string; isRecent: boolean }> } }
  | { type: 'SET_AUTOCOMPLETE_INDEX'; payload: number }
  | { type: 'CLOSE_AUTOCOMPLETE' }
  | { type: 'CLEAR' }
  | { type: 'RESET' }

const initialState: PromptBoxState = {
  text: '',
  cursorPosition: 0,
  files: [],
  images: [],
  isExpanded: false,
  isFocused: false,
  isDropzoneActive: false,
  autocomplete: {
    isOpen: false,
    searchTerm: '',
    selectedIndex: 0,
    results: [],
    position: { x: 0, y: 0 },
  },
}

function reducer(state: PromptBoxState, action: Action): PromptBoxState {
  switch (action.type) {
    case 'SET_TEXT':
      return { ...state, text: action.payload }
    case 'SET_CURSOR':
      return { ...state, cursorPosition: action.payload }
    case 'ADD_FILE': {
      const { file, replaceStart, replaceEnd } = action.payload
      // Replace @search with [filename]
      const newText =
        state.text.slice(0, replaceStart) + file.referenceText + state.text.slice(replaceEnd)
      const newCursor = replaceStart + file.referenceText.length
      return {
        ...state,
        text: newText,
        cursorPosition: newCursor,
        files: [...state.files, file],
      }
    }
    case 'REMOVE_FILE': {
      const fileToRemove = state.files.find((f) => f.path === action.payload)
      let newText = state.text
      if (fileToRemove) {
        newText = state.text.replace(fileToRemove.referenceText, '')
      }
      return {
        ...state,
        text: newText,
        files: state.files.filter((f) => f.path !== action.payload),
      }
    }
    case 'ADD_IMAGE': {
      const { image, cursorPosition } = action.payload
      const reference = `[image ${image.referenceNumber}]`
      const newText =
        state.text.slice(0, cursorPosition) + reference + state.text.slice(cursorPosition)
      const newCursor = cursorPosition + reference.length
      return {
        ...state,
        text: newText,
        cursorPosition: newCursor,
        images: [...state.images, image],
      }
    }
    case 'UPDATE_IMAGE':
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.payload.id ? { ...img, ...action.payload.updates } : img
        ),
      }
    case 'REMOVE_IMAGE': {
      const imageToRemove = state.images.find((img) => img.id === action.payload)
      let newText = state.text
      if (imageToRemove) {
        const reference = `[image ${imageToRemove.referenceNumber}]`
        newText = state.text.replace(reference, '')
      }
      return {
        ...state,
        text: newText,
        images: state.images.filter((img) => img.id !== action.payload),
      }
    }
    case 'SET_EXPANDED':
      return { ...state, isExpanded: action.payload }
    case 'SET_FOCUSED':
      return { ...state, isFocused: action.payload }
    case 'SET_DROPZONE_ACTIVE':
      return { ...state, isDropzoneActive: action.payload }
    case 'OPEN_AUTOCOMPLETE':
      return {
        ...state,
        autocomplete: {
          ...state.autocomplete,
          isOpen: true,
          searchTerm: action.payload.searchTerm,
          position: action.payload.position,
          selectedIndex: 0,
        },
      }
    case 'UPDATE_AUTOCOMPLETE':
      return {
        ...state,
        autocomplete: {
          ...state.autocomplete,
          searchTerm: action.payload.searchTerm,
          results: action.payload.results,
          selectedIndex: 0,
        },
      }
    case 'SET_AUTOCOMPLETE_INDEX':
      return {
        ...state,
        autocomplete: { ...state.autocomplete, selectedIndex: action.payload },
      }
    case 'CLOSE_AUTOCOMPLETE':
      return {
        ...state,
        autocomplete: { ...initialState.autocomplete },
      }
    case 'CLEAR':
      return { ...initialState, isExpanded: state.isExpanded }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

interface UsePromptBoxProps {
  defaultValue?: string
  defaultExpanded?: boolean
}

export function usePromptBox({ defaultValue = '', defaultExpanded = false }: UsePromptBoxProps = {}) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    text: defaultValue,
    isExpanded: defaultExpanded,
  })

  const setText = useCallback((text: string) => {
    dispatch({ type: 'SET_TEXT', payload: text })
  }, [])

  const setCursor = useCallback((position: number) => {
    dispatch({ type: 'SET_CURSOR', payload: position })
  }, [])

  const addFile = useCallback((path: string, replaceStart: number, replaceEnd: number) => {
    const filename = path.split('/').pop() || path
    const referenceText = `[${filename}]`
    const file: PromptFile = {
      path,
      filename,
      referenceText,
      addedAt: new Date(),
    }
    dispatch({ type: 'ADD_FILE', payload: { file, replaceStart, replaceEnd } })
  }, [])

  const removeFile = useCallback((path: string) => {
    dispatch({ type: 'REMOVE_FILE', payload: path })
  }, [])

  const addImage = useCallback((image: PromptImage, cursorPosition: number) => {
    dispatch({ type: 'ADD_IMAGE', payload: { image, cursorPosition } })
  }, [])

  const updateImage = useCallback((id: string, updates: Partial<PromptImage>) => {
    dispatch({ type: 'UPDATE_IMAGE', payload: { id, updates } })
  }, [])

  const removeImage = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_IMAGE', payload: id })
  }, [])

  const setExpanded = useCallback((expanded: boolean) => {
    dispatch({ type: 'SET_EXPANDED', payload: expanded })
  }, [])

  const setFocused = useCallback((focused: boolean) => {
    dispatch({ type: 'SET_FOCUSED', payload: focused })
  }, [])

  const setDropzoneActive = useCallback((active: boolean) => {
    dispatch({ type: 'SET_DROPZONE_ACTIVE', payload: active })
  }, [])

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const getPromptData = useCallback((): PromptData => {
    return {
      text: state.text,
      files: state.files.map((f) => ({
        path: f.path,
        filename: f.filename,
        referenceText: f.referenceText,
      })),
      images: state.images
        .filter((img) => img.status === 'uploaded' && img.url)
        .map((img) => ({
          id: img.id,
          url: img.url!,
          filename: img.filename,
          filePath: img.filePath,
          referenceNumber: img.referenceNumber,
        })),
    }
  }, [state.text, state.files, state.images])

  return {
    state,
    setText,
    setCursor,
    addFile,
    removeFile,
    addImage,
    updateImage,
    removeImage,
    setExpanded,
    setFocused,
    setDropzoneActive,
    clear,
    reset,
    getPromptData,
  }
}
