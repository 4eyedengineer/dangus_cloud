import { useState } from 'react'
import TerminalInput from './TerminalInput'

/**
 * ServiceTable - Terminal-styled table for reviewing and selecting services to import
 *
 * Table format:
 * [ ] | TYPE  | NAME     | PORT | SOURCE              | STORAGE
 * [x] | BUILD | api      | 3000 | ./backend/Dockerfile| -
 * [x] | IMAGE | postgres | 5432 | postgres:15         | *
 */
export function ServiceTable({
  services = [],
  onChange,
  className = ''
}) {
  const [editingPort, setEditingPort] = useState(null)

  const handleToggle = (index) => {
    const updated = services.map((s, i) =>
      i === index ? { ...s, selected: !s.selected } : s
    )
    onChange(updated)
  }

  const handleToggleAll = () => {
    const allSelected = services.every(s => s.selected)
    const updated = services.map(s => ({ ...s, selected: !allSelected }))
    onChange(updated)
  }

  const handlePortChange = (index, value) => {
    const port = parseInt(value, 10)
    if (!isNaN(port) && port >= 1 && port <= 65535) {
      const updated = services.map((s, i) =>
        i === index ? { ...s, port } : s
      )
      onChange(updated)
    }
  }

  const handleNameChange = (index, value) => {
    const name = value.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 63)
    const updated = services.map((s, i) =>
      i === index ? { ...s, name } : s
    )
    onChange(updated)
  }

  const getSourceDisplay = (service) => {
    if (service.image) {
      return service.image
    }
    if (service.build) {
      const context = service.build.context === '.' ? '' : `${service.build.context}/`
      return `${context}${service.build.dockerfile}`
    }
    return '-'
  }

  const getTypeLabel = (service) => {
    if (service.image && !service.build) return 'IMAGE'
    return 'BUILD'
  }

  const getTypeColor = (service) => {
    if (service.image && !service.build) return 'text-terminal-cyan'
    return 'text-terminal-secondary'
  }

  const allSelected = services.length > 0 && services.every(s => s.selected)
  const someSelected = services.some(s => s.selected) && !allSelected

  return (
    <div className={`font-mono ${className}`}>
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-terminal-border bg-terminal-bg-secondary text-xs text-terminal-muted uppercase tracking-wide">
        <div className="col-span-1 flex items-center">
          <button
            onClick={handleToggleAll}
            className="w-4 h-4 border border-terminal-muted flex items-center justify-center hover:border-terminal-primary transition-colors"
            title={allSelected ? 'Deselect all' : 'Select all'}
          >
            {allSelected && <span className="text-terminal-primary text-xs">&#10003;</span>}
            {someSelected && <span className="text-terminal-muted text-xs">-</span>}
          </button>
        </div>
        <div className="col-span-1">TYPE</div>
        <div className="col-span-2">NAME</div>
        <div className="col-span-1">PORT</div>
        <div className="col-span-4">SOURCE</div>
        <div className="col-span-2">SERVICE TYPE</div>
        <div className="col-span-1 text-center">STOR</div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-terminal-border">
        {services.map((service, index) => (
          <div
            key={index}
            className={`
              grid grid-cols-12 gap-2 px-3 py-2 items-center
              ${service.selected
                ? 'bg-terminal-primary/5'
                : 'opacity-50'
              }
              hover:bg-terminal-bg-secondary transition-colors
            `}
          >
            {/* Checkbox */}
            <div className="col-span-1">
              <button
                onClick={() => handleToggle(index)}
                className={`
                  w-4 h-4 border flex items-center justify-center transition-colors
                  ${service.selected
                    ? 'border-terminal-primary'
                    : 'border-terminal-muted hover:border-terminal-primary'
                  }
                `}
              >
                {service.selected && (
                  <span className="text-terminal-primary text-xs">&#10003;</span>
                )}
              </button>
            </div>

            {/* Type */}
            <div className={`col-span-1 text-xs ${getTypeColor(service)}`}>
              {getTypeLabel(service)}
            </div>

            {/* Name - Editable */}
            <div className="col-span-2">
              <input
                type="text"
                value={service.name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                className={`
                  w-full bg-transparent border-b border-transparent
                  focus:border-terminal-primary focus:outline-none
                  text-sm
                  ${service.selected
                    ? 'text-terminal-primary'
                    : 'text-terminal-muted'
                  }
                `}
                disabled={!service.selected}
              />
            </div>

            {/* Port - Editable */}
            <div className="col-span-1">
              {editingPort === index ? (
                <input
                  type="number"
                  value={service.port}
                  onChange={(e) => handlePortChange(index, e.target.value)}
                  onBlur={() => setEditingPort(null)}
                  className="w-full bg-transparent border-b border-terminal-primary text-terminal-primary focus:outline-none text-sm"
                  min="1"
                  max="65535"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => service.selected && setEditingPort(index)}
                  className={`
                    text-sm
                    ${service.selected
                      ? 'text-terminal-primary hover:underline cursor-pointer'
                      : 'text-terminal-muted cursor-not-allowed'
                    }
                  `}
                  disabled={!service.selected}
                >
                  {service.port}
                </button>
              )}
            </div>

            {/* Source */}
            <div className="col-span-4 text-xs text-terminal-muted truncate" title={getSourceDisplay(service)}>
              {getSourceDisplay(service)}
            </div>

            {/* Service Type */}
            <div className="col-span-2 text-xs text-terminal-muted uppercase">
              {service.type || 'container'}
            </div>

            {/* Storage Indicator */}
            <div className="col-span-1 text-center">
              {service.hasStorage ? (
                <span className="text-terminal-secondary" title="Requires storage">&#9679;</span>
              ) : (
                <span className="text-terminal-muted">-</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-t border-terminal-border bg-terminal-bg-secondary text-xs text-terminal-muted">
        {services.filter(s => s.selected).length} of {services.length} service(s) selected
      </div>
    </div>
  )
}

export default ServiceTable
