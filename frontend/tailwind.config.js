/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          // Background colors
          'bg-primary': '#0a0a0a',
          'bg-secondary': '#121212',
          'bg-elevated': '#151515',
          // Primary (phosphor green)
          'primary': '#33ff33',
          'primary-dim': '#22cc22',
          // Secondary (amber)
          'secondary': '#ffaa00',
          'secondary-dim': '#cc8800',
          // Accent red
          'red': '#ff3333',
          'red-dim': '#cc2222',
          // Accent cyan
          'cyan': '#00ffff',
          // Muted grays
          'muted': '#666666',
          'muted-dark': '#444444',
          'border': '#333333',
        },
      },
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Source Code Pro',
          'IBM Plex Mono',
          'Consolas',
          'Monaco',
          'monospace',
        ],
      },
      fontSize: {
        'terminal-xs': ['12px', { lineHeight: '1.5' }],
        'terminal-sm': ['13px', { lineHeight: '1.5' }],
        'terminal-base': ['14px', { lineHeight: '1.5' }],
        'terminal-lg': ['16px', { lineHeight: '1.5' }],
      },
      letterSpacing: {
        'terminal': '0.5px',
        'terminal-wide': '1px',
      },
      boxShadow: {
        'glow-green': '0 0 10px rgba(51, 255, 51, 0.5)',
        'glow-green-lg': '0 0 20px rgba(51, 255, 51, 0.6)',
        'glow-amber': '0 0 10px rgba(255, 170, 0, 0.5)',
        'glow-amber-lg': '0 0 20px rgba(255, 170, 0, 0.6)',
        'glow-red': '0 0 10px rgba(255, 51, 51, 0.5)',
        'glow-red-lg': '0 0 20px rgba(255, 51, 51, 0.6)',
        'glow-cyan': '0 0 10px rgba(0, 255, 255, 0.5)',
      },
      spacing: {
        'terminal-unit': '8px',
      },
      transitionTimingFunction: {
        'terminal': 'steps(4)',
      },
      transitionDuration: {
        'terminal-fast': '100ms',
        'terminal-base': '150ms',
        'terminal-slow': '200ms',
      },
      animation: {
        'cursor-blink': 'cursor-blink 1.06s step-end infinite',
        'text-flicker': 'text-flicker 0.1s ease-in-out',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'text-flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
}
