/**
 * CommandFlags - Displays CLI-style flags above sections
 *
 * Usage:
 * <CommandFlags flags={['--show-resources', '--condensed']} />
 *
 * Renders: --show-resources --condensed
 */
export function CommandFlags({
  flags = [],
  className = ''
}) {
  if (!Array.isArray(flags) || flags.length === 0) return null

  return (
    <div
      className={`
        font-mono text-terminal-ghost
        text-[0.85em] tracking-[0.5px]
        mb-1 select-none
        ${className}
      `}
      aria-hidden="true"
    >
      {flags.join(' ')}
    </div>
  )
}

export default CommandFlags
