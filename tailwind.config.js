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
      backgroundImage: {
        hero:
          'radial-gradient(ellipse 90% 55% at 8% -8%, rgba(34,160,107,0.28) 0%, transparent 58%), radial-gradient(ellipse 70% 50% at 96% 2%, rgba(232,139,46,0.22) 0%, transparent 52%), radial-gradient(ellipse 55% 40% at 70% 85%, rgba(47,111,237,0.10) 0%, transparent 55%), linear-gradient(165deg, #F4FBF7 0%, #EEF6F1 42%, #F7F3EE 100%)',
        'hero-dark':
          'radial-gradient(ellipse 80% 50% at 0% -10%, rgba(34,160,107,0.22) 0%, transparent 55%), radial-gradient(ellipse 70% 45% at 100% 0%, rgba(232,139,46,0.14) 0%, transparent 50%), linear-gradient(180deg, #0C1014 0%, #121820 100%)',
      },
      boxShadow: {
        soft: '0 8px 32px rgba(26, 31, 44, 0.08)',
        glass: '0 8px 32px rgba(34, 160, 107, 0.07), 0 2px 12px rgba(26, 31, 44, 0.05)',
        'glass-lift': '0 16px 48px rgba(34, 160, 107, 0.12), 0 4px 16px rgba(26, 31, 44, 0.06)',
      },
      screens: {
        xs: '400px',
      },
    },
  },
  plugins: [],
}
