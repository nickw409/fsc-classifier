/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:          'oklch(var(--bg))',
        'bg-elev':   'oklch(var(--bg-elev))',
        'bg-subtle': 'oklch(var(--bg-subtle))',
        border:          'oklch(var(--border))',
        'border-strong': 'oklch(var(--border-strong))',
        ink:         'oklch(var(--ink))',
        'ink-2':     'oklch(var(--ink-2))',
        'ink-3':     'oklch(var(--ink-3))',
        'ink-4':     'oklch(var(--ink-4))',
        accent:      'oklch(var(--accent))',
        'accent-hi': 'oklch(var(--accent-hi))',
        'accent-bg': 'oklch(var(--accent-bg))',
        'accent-border': 'oklch(var(--accent-border))',
        'ok-bg':     'oklch(var(--ok-bg))',     'ok-fg':     'oklch(var(--ok-fg))',     'ok-border':   'oklch(var(--ok-border))',
        'warn-bg':   'oklch(var(--warn-bg))',   'warn-fg':   'oklch(var(--warn-fg))',   'warn-border': 'oklch(var(--warn-border))',
        'err-bg':    'oklch(var(--err-bg))',    'err-fg':    'oklch(var(--err-fg))',    'err-border':  'oklch(var(--err-border))',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
