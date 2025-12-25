import { useState, useCallback } from 'react'
import { useToast } from '../components/Toast'

/**
 * Hook for copying text to clipboard with fallback for HTTP contexts
 * @returns {{ copy: (text: string, key?: string) => Promise<void>, copied: string | null }}
 */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(null)
  const toast = useToast()

  const copy = useCallback(async (text, key = 'default') => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for HTTP contexts
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
      toast.success('Copied to clipboard')
    } catch (err) {
      console.error('Copy failed:', err)
      toast.error('Failed to copy to clipboard')
    }
  }, [toast])

  return { copy, copied }
}
