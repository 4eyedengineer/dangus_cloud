import { useState } from 'react'
import {
  AsciiBox,
  AsciiDivider,
  AsciiSectionDivider,
  StatusIndicator,
  StatusBar,
  ProgressGauge,
  Layout,
  SidebarMenu
} from './components'

function App() {
  const [sectionCollapsed, setSectionCollapsed] = useState(false)
  const [activeNav, setActiveNav] = useState('Dashboard')

  const navItems = [
    { label: 'Dashboard', href: '/', active: activeNav === 'Dashboard' },
    { label: 'Projects', href: '/projects', active: activeNav === 'Projects' },
    { label: 'Settings', href: '/settings', active: activeNav === 'Settings' },
    { label: 'Logout', href: '/logout', active: activeNav === 'Logout' }
  ]

  const sidebarMenuItems = [
    { label: 'Overview', active: true },
    { label: 'Deployments' },
    { label: 'Monitoring' },
    { label: 'Logs' },
    { label: 'Configuration' }
  ]

  const handleNavClick = (item) => {
    setActiveNav(item.label)
  }

  const sidebarContent = (
    <SidebarMenu
      items={sidebarMenuItems}
      onItemClick={(item) => console.log('Sidebar item clicked:', item.label)}
    />
  )

  return (
    <Layout
      navItems={navItems}
      onNavClick={handleNavClick}
      breadcrumbs={[
        { label: 'projects', href: '/projects' },
        { label: 'myapp' },
        { label: 'backend' }
      ]}
      sidebarContent={sidebarContent}
      systemStatus="online"
    >
      <div className="space-y-8">
        {/* Status Bar Demo */}
        <StatusBar
          items={[
            { status: 'online', label: 'API' },
            { status: 'active', label: 'DB' },
            { status: 'warning', label: 'CACHE' }
          ]}
          className="mb-4"
        />

        <AsciiDivider variant="double" color="amber" />

        {/* AsciiBox Demo */}
        <section>
          <h2 className="text-terminal-secondary uppercase tracking-terminal-wide mb-4">
            ASCII Box Components
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <AsciiBox title="Configuration" variant="green">
              <div className="text-terminal-primary">
                <p>server: localhost:3000</p>
                <p>mode: development</p>
                <p>debug: enabled</p>
              </div>
            </AsciiBox>

            <AsciiBox title="System Status" variant="amber" glowColor="amber">
              <div className="space-y-2">
                <StatusIndicator status="online" label="Primary Node" />
                <br />
                <StatusIndicator status="active" label="Worker Process" />
                <br />
                <StatusIndicator status="pending" label="Backup Sync" />
              </div>
            </AsciiBox>
          </div>
        </section>

        {/* Divider Demo */}
        <section>
          <AsciiSectionDivider
            title="Divider Variants"
            collapsed={sectionCollapsed}
            onToggle={() => setSectionCollapsed(!sectionCollapsed)}
            color="amber"
          />

          {!sectionCollapsed && (
            <div className="mt-4 space-y-4 pl-4">
              <div>
                <span className="text-terminal-muted text-sm">single:</span>
                <AsciiDivider variant="single" color="muted" />
              </div>
              <div>
                <span className="text-terminal-muted text-sm">double:</span>
                <AsciiDivider variant="double" color="green" />
              </div>
              <div>
                <span className="text-terminal-muted text-sm">dashed:</span>
                <AsciiDivider variant="dashed" color="amber" />
              </div>
              <div>
                <span className="text-terminal-muted text-sm">with label:</span>
                <AsciiDivider variant="single" label="Section" color="cyan" />
              </div>
            </div>
          )}
        </section>

        <AsciiDivider variant="single" color="muted" />

        {/* Status Indicators Demo */}
        <section className="terminal-border p-4">
          <h2 className="text-terminal-secondary uppercase tracking-terminal-wide mb-4">
            Status Indicators
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusIndicator status="online" />
            <StatusIndicator status="offline" />
            <StatusIndicator status="error" />
            <StatusIndicator status="warning" />
            <StatusIndicator status="loading" pulse />
            <StatusIndicator status="idle" />
            <StatusIndicator status="active" />
            <StatusIndicator status="pending" />
          </div>
        </section>

        {/* Progress Gauge Demo */}
        <section className="terminal-border p-4">
          <h2 className="text-terminal-secondary uppercase tracking-terminal-wide mb-4">
            Progress Gauges
          </h2>
          <div className="space-y-4">
            <ProgressGauge value={25} label="CPU Usage" />
            <ProgressGauge value={65} label="Memory" />
            <ProgressGauge value={85} label="Disk" />
            <ProgressGauge value={95} label="Network" />
          </div>
        </section>

        {/* Color Palette Demo */}
        <section className="terminal-border p-4">
          <h2 className="text-terminal-secondary uppercase tracking-terminal-wide mb-4">
            Color Palette
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-terminal-secondary terminal-border">
              <span className="text-terminal-primary">Primary (Green)</span>
            </div>
            <div className="p-4 bg-terminal-secondary terminal-border">
              <span className="text-terminal-secondary">Secondary (Amber)</span>
            </div>
            <div className="p-4 bg-terminal-secondary terminal-border">
              <span className="text-terminal-red">Accent (Red)</span>
            </div>
            <div className="p-4 bg-terminal-secondary terminal-border">
              <span className="text-terminal-muted">Muted (Gray)</span>
            </div>
          </div>
        </section>

        {/* Buttons Demo */}
        <section className="terminal-border p-4">
          <h2 className="text-terminal-secondary uppercase tracking-terminal-wide mb-4">
            Buttons
          </h2>
          <div className="flex flex-wrap gap-4">
            <button className="btn-terminal">Primary Action</button>
            <button className="btn-terminal-amber">Secondary Action</button>
            <button className="btn-terminal-red">Danger Action</button>
          </div>
        </section>

        {/* Input Demo */}
        <section className="terminal-border p-4">
          <h2 className="text-terminal-secondary uppercase tracking-terminal-wide mb-4">
            Inputs
          </h2>
          <div className="space-y-4 max-w-md">
            <input
              type="text"
              className="input-terminal w-full"
              placeholder="> Enter command..."
            />
          </div>
        </section>
      </div>
    </Layout>
  )
}

export default App
