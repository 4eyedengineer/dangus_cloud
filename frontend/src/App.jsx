function App() {
  return (
    <div className="min-h-screen bg-terminal-primary p-8">
      <header className="terminal-border p-4 mb-8">
        <h1 className="text-terminal-primary text-2xl font-bold tracking-terminal-wide text-glow-green">
          DANGUS CLOUD
        </h1>
        <p className="text-terminal-secondary mt-2">
          Terminal UI Design System
        </p>
      </header>

      <main className="space-y-8">
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

        {/* Glow Effects Demo */}
        <section className="terminal-border p-4">
          <h2 className="text-terminal-secondary uppercase tracking-terminal-wide mb-4">
            Glow Effects
          </h2>
          <div className="flex flex-wrap gap-4">
            <div className="p-4 terminal-border-green glow-green">
              <span className="text-terminal-primary">.glow-green</span>
            </div>
            <div className="p-4 terminal-border-amber glow-amber">
              <span className="text-terminal-secondary">.glow-amber</span>
            </div>
            <div className="p-4 terminal-border-red glow-red">
              <span className="text-terminal-red">.glow-red</span>
            </div>
          </div>
        </section>

        {/* Button Demo */}
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

        {/* Link Demo */}
        <section className="terminal-border p-4">
          <h2 className="text-terminal-secondary uppercase tracking-terminal-wide mb-4">
            Links
          </h2>
          <div className="space-x-4">
            <a href="#" className="link-terminal">
              Standard Link
            </a>
            <a href="#" className="link-terminal link-terminal-bracketed">
              Bracketed Link
            </a>
          </div>
        </section>
      </main>

      <footer className="mt-8 pt-4 terminal-border text-terminal-muted text-sm">
        <p>STATUS: All systems operational</p>
      </footer>
    </div>
  )
}

export default App
