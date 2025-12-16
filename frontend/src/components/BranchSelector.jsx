import { useState, useEffect, useRef } from 'react'
import { listBranches } from '../api/github'
import TerminalSpinner from './TerminalSpinner'

/**
 * BranchSelector - Terminal-styled branch selector with autocomplete
 */
export function BranchSelector({
  repoUrl,
  value,
  onChange,
  disabled = false,
  className = ''
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const listRef = useRef(null)

  // Fetch branches when repoUrl changes or search changes
  useEffect(() => {
    if (!repoUrl) {
      setBranches([])
      return
    }

    const fetchBranches = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await listBranches(repoUrl, search)
        setBranches(data.branches || [])
        setHighlightedIndex(0)
      } catch (err) {
        setError(err.message || 'Failed to load branches')
        setBranches([])
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(fetchBranches, 300)
    return () => clearTimeout(debounce)
  }, [repoUrl, search])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(i => Math.min(i + 1, branches.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (branches[highlightedIndex]) {
          handleSelect(branches[highlightedIndex].name)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setSearch('')
        break
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current && branches.length > 0) {
      const highlightedEl = listRef.current.children[highlightedIndex]
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, open, branches.length])

  const handleSelect = (branchName) => {
    onChange(branchName)
    setOpen(false)
    setSearch('')
  }

  const handleInputChange = (e) => {
    setSearch(e.target.value)
    if (!open) setOpen(true)
  }

  const handleInputFocus = () => {
    if (!disabled && repoUrl) {
      setOpen(true)
    }
  }

  const displayValue = open ? search : value

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={!repoUrl ? 'Select repository first' : 'Select branch...'}
          disabled={disabled || !repoUrl}
          className={`
            w-full bg-terminal-bg border border-terminal-border
            text-terminal-text font-mono px-3 py-2 pr-8
            focus:border-terminal-primary focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <span className="text-terminal-muted text-xs">
            {loading ? <TerminalSpinner /> : '▼'}
          </span>
        </div>
      </div>

      {open && repoUrl && (
        <div className="absolute z-50 w-full mt-1 bg-terminal-bg border border-terminal-border max-h-60 overflow-hidden">
          {error ? (
            <div className="px-3 py-2 text-terminal-red text-sm">
              ! {error}
            </div>
          ) : loading && branches.length === 0 ? (
            <div className="px-3 py-2 text-terminal-muted flex items-center gap-2">
              <TerminalSpinner />
              <span>Loading branches...</span>
            </div>
          ) : branches.length === 0 ? (
            <div className="px-3 py-2 text-terminal-muted">
              {search ? `No branches matching "${search}"` : 'No branches found'}
            </div>
          ) : (
            <div ref={listRef} className="overflow-y-auto max-h-60">
              {branches.map((branch, index) => (
                <button
                  key={branch.name}
                  type="button"
                  onClick={() => handleSelect(branch.name)}
                  className={`
                    w-full px-3 py-2 text-left font-mono text-sm
                    flex items-center justify-between gap-2
                    transition-colors
                    ${index === highlightedIndex
                      ? 'bg-terminal-primary/20 text-terminal-primary'
                      : 'hover:bg-terminal-bg-secondary'
                    }
                    ${branch.name === value
                      ? 'border-l-2 border-terminal-primary'
                      : 'border-l-2 border-transparent'
                    }
                  `}
                >
                  <span className="truncate">{branch.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {branch.isDefault && (
                      <span className="text-xs text-terminal-cyan border border-terminal-cyan px-1">
                        DEFAULT
                      </span>
                    )}
                    {branch.protected && (
                      <span className="text-xs text-terminal-secondary border border-terminal-secondary px-1">
                        PROTECTED
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BranchSelector
