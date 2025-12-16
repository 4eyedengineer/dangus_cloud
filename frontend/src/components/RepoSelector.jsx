import { useState, useEffect, useCallback } from 'react'
import TerminalInput from './TerminalInput'
import TerminalButton from './TerminalButton'
import TerminalSpinner from './TerminalSpinner'
import { BranchSelector } from './BranchSelector'
import { listRepos } from '../api/github'

/**
 * RepoSelector - Terminal-styled GitHub repository selector
 */
export function RepoSelector({
  onSelect,
  onCancel,
  className = ''
}) {
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState('')

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadRepos = useCallback(async (pageNum, searchTerm, append = false) => {
    setLoading(true)
    setError(null)

    try {
      const result = await listRepos({
        page: pageNum,
        perPage: 20,
        search: searchTerm || undefined
      })

      if (append) {
        setRepos(prev => [...prev, ...result.repos])
      } else {
        setRepos(result.repos)
      }
      setHasMore(result.hasMore)
    } catch (err) {
      setError(err.message || 'Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRepos(page, debouncedSearch, page > 1)
  }, [page, debouncedSearch, loadRepos])

  const handleLoadMore = () => {
    setPage(p => p + 1)
  }

  const handleRepoClick = (repo) => {
    setSelectedRepo(repo)
    setSelectedBranch(repo.defaultBranch)
  }

  const handleConfirm = () => {
    if (selectedRepo) {
      // Include the selected branch in the repo object
      onSelect({
        ...selectedRepo,
        defaultBranch: selectedBranch || selectedRepo.defaultBranch
      })
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 30) return `${diffDays}d ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
  }

  return (
    <div className={`font-mono ${className}`}>
      {/* Search Input */}
      <div className="mb-4">
        <TerminalInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search repositories..."
          className="w-full"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 border border-terminal-red bg-terminal-bg-secondary flex items-center justify-between">
          <span className="text-terminal-red">! {error}</span>
          <TerminalButton
            variant="secondary"
            onClick={() => {
              setError(null)
              loadRepos(1, debouncedSearch, false)
            }}
          >
            [ RETRY ]
          </TerminalButton>
        </div>
      )}

      {/* Repository List */}
      <div className="border border-terminal-border bg-terminal-bg-secondary max-h-96 overflow-y-auto">
        {loading && repos.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <TerminalSpinner />
            <span className="ml-3 text-terminal-muted">Loading repositories...</span>
          </div>
        ) : repos.length === 0 ? (
          <div className="text-center py-12 text-terminal-muted">
            No repositories found
          </div>
        ) : (
          <div className="divide-y divide-terminal-border">
            {repos.map(repo => (
              <div
                key={repo.id}
                onClick={() => handleRepoClick(repo)}
                className={`
                  p-3 cursor-pointer transition-colors
                  ${selectedRepo?.id === repo.id
                    ? 'bg-terminal-primary/10 border-l-2 border-terminal-primary'
                    : 'hover:bg-terminal-bg-secondary border-l-2 border-transparent'
                  }
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`
                        truncate
                        ${selectedRepo?.id === repo.id
                          ? 'text-terminal-primary text-glow-green'
                          : 'text-terminal-primary'
                        }
                      `}>
                        {repo.fullName}
                      </span>
                      {repo.private && (
                        <span className="text-xs text-terminal-secondary border border-terminal-secondary px-1">
                          PRIVATE
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <div className="text-xs text-terminal-muted mt-1 truncate">
                        {repo.description}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-terminal-muted">
                      {repo.language && (
                        <span>{repo.language}</span>
                      )}
                      <span>{repo.defaultBranch}</span>
                      <span>Updated {formatDate(repo.updatedAt)}</span>
                    </div>
                  </div>
                  {selectedRepo?.id === repo.id && (
                    <span className="text-terminal-primary">&#10003;</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <div className="p-3 border-t border-terminal-border">
            <TerminalButton
              variant="secondary"
              onClick={handleLoadMore}
              className="w-full"
            >
              [ LOAD MORE ]
            </TerminalButton>
          </div>
        )}

        {loading && repos.length > 0 && (
          <div className="p-3 text-center">
            <TerminalSpinner />
          </div>
        )}
      </div>

      {/* Branch Selector - shown when a repo is selected */}
      {selectedRepo && (
        <div className="mt-4 p-3 border border-terminal-border bg-terminal-bg-secondary">
          <label className="block font-mono text-xs text-terminal-muted uppercase mb-2">
            Branch
          </label>
          <BranchSelector
            repoUrl={selectedRepo.url}
            value={selectedBranch}
            onChange={setSelectedBranch}
          />
          <p className="font-mono text-xs text-terminal-muted mt-2">
            Select a branch to import from
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-4">
        <TerminalButton variant="secondary" onClick={onCancel}>
          [ CANCEL ]
        </TerminalButton>
        <TerminalButton
          variant="primary"
          onClick={handleConfirm}
          disabled={!selectedRepo || !selectedBranch}
        >
          [ SELECT REPO ]
        </TerminalButton>
      </div>
    </div>
  )
}

export default RepoSelector
