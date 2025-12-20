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
          // Background colors (v2 spec)
          'bg-primary': '#0d0d0d',
          'bg-secondary': '#1a1a1a',
          'bg-elevated': '#252525',
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
          // Text hierarchy (brightness-based)
          'muted': '#888888',
          'ghost': '#444444',
          'border': '#333333',
        },
        // Chart spectrum (v2)
        chart: {
          'cyan': '#00ffcc',
          'magenta': '#ff66ff',
          'purple': '#9966ff',
          'orange': '#ff9933',
          'blue': '#3399ff',
        },
        // Status thresholds (v2)
        status: {
          'healthy': '#33ff33',
          'warning': '#aaff33',
          'caution': '#ffaa33',
          'critical': '#ff3333',
        },
        // Heat gradient for logo
        heat: {
          '1': '#ff3333',
          '2': '#ff6633',
          '3': '#ff9933',
          '4': '#ffcc33',
          '5': '#33ff33',
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
