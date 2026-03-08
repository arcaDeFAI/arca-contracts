/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'arca-green': '#00ff88',
        'arca-dark': '#050505',
        'arca-gray': '#0a0a0a',
        'arca-light-gray': '#141414',
        // Enhanced contrast colors
        'arca-card': '#121218',
        'arca-card-hover': '#1a1a22',
        'arca-border': '#2a2a35',
        'arca-border-light': '#3a3a45',
        'arca-text-secondary': '#a0a0b0',
        'arca-text-muted': '#7a7a8a',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
}
