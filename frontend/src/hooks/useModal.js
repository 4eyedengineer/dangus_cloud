import { useState, useCallback } from 'react'

/**
 * Generic hook for managing modal state
 * @template T
 * @returns {{
 *   isOpen: boolean,
 *   data: T | null,
 *   open: (data?: T) => void,
 *   close: () => void
 * }}
 */
export function useModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState(null)

  const open = useCallback((modalData = null) => {
    setData(modalData)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setData(null)
  }, [])

  return { isOpen, data, open, close }
}

export default useModal
