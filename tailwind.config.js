/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#22A06B',
          'green-soft': '#E8F6EF',
          orange: '#E88B2E',
          'orange-soft': '#FFF4E8',
          blue: '#2F6FED',
          'blue-soft': '#EAF0FE',
          ink: '#1A1F2C',
          muted: '#6B7280',
          soft: '#F5F7FA',
        },
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '24px',
      },
      boxShadow: {
        soft: '0 8px 32px rgba(26, 31, 44, 0.08)',
        glass: '0 4px 24px rgba(26, 31, 44, 0.06)',
      },
      backgroundImage: {
        hero: 'radial-gradient(ellipse at top left, #E8F6EF 0%, transparent 50%), radial-gradient(ellipse at bottom right, #FFF4E8 0%, transparent 45%), linear-gradient(180deg, #F8FAFC 0%, #F0F4F8 100%)',
        'hero-dark':
          'radial-gradient(ellipse at top left, rgba(34,160,107,0.18) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(232,139,46,0.12) 0%, transparent 45%), linear-gradient(180deg, #0F1419 0%, #151B23 100%)',
      },
    },
  },
  plugins: [],
}
