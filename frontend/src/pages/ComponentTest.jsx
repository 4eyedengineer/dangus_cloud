/**
 * Component Test Page - Visual comparison of old vs new terminal components
 *
 * Access at: /test-components (temporary route for testing)
 *
 * This page compares:
 * - AsciiBox (character-based) vs TerminalCard (CSS-based)
 * - AsciiDivider vs TerminalDivider
 * - AsciiSectionDivider vs TerminalSection
 */

import { useState } from 'react'
import { AsciiBox } from '../components/AsciiBox'
import { AsciiDivider, AsciiSectionDivider } from '../components/AsciiDivider'
import { TerminalCard, TerminalDivider, TerminalSection, TerminalModal } from '../components/TerminalCard'
import TerminalButton from '../components/TerminalButton'

export function ComponentTest() {
  const [showModal, setShowModal] = useState(false)
  const [sectionCollapsed, setSectionCollapsed] = useState(false)
  const [asciiSectionCollapsed, setAsciiSectionCollapsed] = useState(false)

  return (
    <div className="p-6 space-y-8">
      <h1 className="font-mono text-xl text-terminal-primary text-glow-green uppercase">
        Component Comparison Test
      </h1>
      <p className="font-mono text-sm text-terminal-muted">
        Side-by-side comparison of character-based vs CSS-based components
      </p>

      {/* Box Comparison */}
      <section className="space-y-4">
        <h2 className="font-mono text-terminal-secondary uppercase">
          Box Components
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Old: AsciiBox */}
          <div>
            <p className="font-mono text-xs text-terminal-muted mb-2">
              OLD: AsciiBox (character-based)
            </p>
            <AsciiBox title="GitHub Connection" variant="green">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-terminal-muted text-xs">USERNAME:</span>
                  <span className="text-terminal-primary text-sm">testuser</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-terminal-muted text-xs">STATUS:</span>
                  <span className="text-terminal-secondary text-sm">Connected</span>
                </div>
              </div>
            </AsciiBox>
          </div>

          {/* New: TerminalCard */}
          <div>
            <p className="font-mono text-xs text-terminal-muted mb-2">
              NEW: TerminalCard (CSS-based)
            </p>
            <TerminalCard title="GitHub Connection" variant="green">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-terminal-muted text-xs">USERNAME:</span>
                  <span className="text-terminal-primary text-sm">testuser</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-terminal-muted text-xs">STATUS:</span>
                  <span className="text-terminal-secondary text-sm">Connected</span>
                </div>
              </div>
            </TerminalCard>
          </div>
        </div>

        {/* Long title test */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="font-mono text-xs text-terminal-muted mb-2">
              OLD: Long title (may break)
            </p>
            <AsciiBox title="A Very Long Section Title That Exceeds Normal Bounds" variant="amber">
              <p className="text-terminal-muted text-xs">Content inside the box</p>
            </AsciiBox>
          </div>

          <div>
            <p className="font-mono text-xs text-terminal-muted mb-2">
              NEW: Long title (responsive)
            </p>
            <TerminalCard title="A Very Long Section Title That Exceeds Normal Bounds" variant="amber">
              <p className="text-terminal-muted text-xs">Content inside the box</p>
            </TerminalCard>
          </div>
        </div>

        {/* All variants */}
        <div className="space-y-4">
          <p className="font-mono text-xs text-terminal-muted">
            NEW: TerminalCard variants with glow
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <TerminalCard title="Default" variant="default">
              <p className="text-xs text-terminal-muted">Default variant</p>
            </TerminalCard>
            <TerminalCard title="Green" variant="green" glow>
              <p className="text-xs text-terminal-muted">Green with glow</p>
            </TerminalCard>
            <TerminalCard title="Amber" variant="amber" glow>
              <p className="text-xs text-terminal-muted">Amber with glow</p>
            </TerminalCard>
            <TerminalCard title="Red" variant="red" glow>
              <p className="text-xs text-terminal-muted">Red with glow</p>
            </TerminalCard>
          </div>
        </div>
      </section>

      {/* Divider Comparison */}
      <section className="space-y-4">
        <h2 className="font-mono text-terminal-secondary uppercase">
          Divider Components
        </h2>

        <div className="space-y-6">
          <div>
            <p className="font-mono text-xs text-terminal-muted mb-2">
              OLD: AsciiDivider (character repeat)
            </p>
            <AsciiDivider variant="double" color="green" />
          </div>

          <div>
            <p className="font-mono text-xs text-terminal-muted mb-2">
              NEW: TerminalDivider (CSS border)
            </p>
            <TerminalDivider variant="double" color="green" />
          </div>

          <div>
            <p className="font-mono text-xs text-terminal-muted mb-2">
              OLD: AsciiDivider with label
            </p>
            <AsciiDivider variant="single" color="amber" label="SECTION" />
          </div>

          <div>
            <p className="font-mono text-xs text-terminal-muted mb-2">
              NEW: TerminalDivider with label
            </p>
            <TerminalDivider variant="single" color="amber" label="SECTION" />
          </div>
        </div>
      </section>

      {/* Section Header Comparison */}
      <section className="space-y-4">
        <h2 className="font-mono text-terminal-secondary uppercase">
          Section Headers
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="font-mono text-xs text-terminal-muted mb-2">
              OLD: AsciiSectionDivider (character repeat)
            </p>
            <AsciiSectionDivider
              title="ACTIVE PROJECTS"
              collapsed={asciiSectionCollapsed}
              onToggle={() => setAsciiSectionCollapsed(!asciiSectionCollapsed)}
              color="amber"
            />
            {!asciiSectionCollapsed && (
              <div className="mt-2 p-3 bg-terminal-secondary">
                <p className="text-terminal-muted text-xs">Section content here</p>
              </div>
            )}
          </div>

          <div>
            <p className="font-mono text-xs text-terminal-muted mb-2">
              NEW: TerminalSection (CSS border)
            </p>
            <TerminalSection
              title="ACTIVE PROJECTS"
              collapsed={sectionCollapsed}
              onToggle={() => setSectionCollapsed(!sectionCollapsed)}
              color="amber"
            >
              <div className="p-3 bg-terminal-secondary">
                <p className="text-terminal-muted text-xs">Section content here</p>
              </div>
            </TerminalSection>
          </div>
        </div>
      </section>

      {/* Modal Test */}
      <section className="space-y-4">
        <h2 className="font-mono text-terminal-secondary uppercase">
          Modal Component
        </h2>

        <TerminalButton variant="primary" onClick={() => setShowModal(true)}>
          [ OPEN MODAL ]
        </TerminalButton>

        {showModal && (
          <TerminalModal
            title="CONFIRM ACTION"
            variant="amber"
            onClose={() => setShowModal(false)}
          >
            <div className="space-y-4">
              <p className="font-mono text-terminal-primary">
                This is the new CSS-based modal.
              </p>
              <p className="font-mono text-xs text-terminal-muted">
                No hardcoded character widths - fully responsive.
              </p>
              <div className="flex justify-end gap-3">
                <TerminalButton variant="secondary" onClick={() => setShowModal(false)}>
                  [ CANCEL ]
                </TerminalButton>
                <TerminalButton variant="primary" onClick={() => setShowModal(false)}>
                  [ CONFIRM ]
                </TerminalButton>
              </div>
            </div>
          </TerminalModal>
        )}
      </section>

      {/* Responsive Test Note */}
      <section className="border border-terminal-cyan p-4">
        <h3 className="font-mono text-terminal-cyan uppercase mb-2">
          Responsive Test
        </h3>
        <p className="font-mono text-xs text-terminal-muted">
          Resize your browser window to test responsiveness. The OLD character-based
          components may overflow or misalign on narrow screens, while the NEW CSS-based
          components should remain properly bounded.
        </p>
      </section>
    </div>
  )
}

export default ComponentTest
