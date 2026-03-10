/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#9DCD8B',
        'primary-hover': '#8FC27B',
        sageTint: '#EEF4E8',
        appBg: '#F4F7F2',
        surface: '#FBFCF8',
        softBorder: '#DDE6D8',
        textMain: '#24332D',
        textSec: '#6E7C74',
        peach: '#E8B07A',
        lime: '#D6E58B',
        warning: '#E7C27D',
        danger: '#D97C6C',
        
        // --- Dark Theme Semantic Tokens ---
        darkappBg: '#181C1A',      // Deep soft charcoal-olive
        darksurface: '#212623',    // Elevated card
        darksageTint: '#2A332C',   // Muted sage chip/sidebar
        darksoftBorder: '#2C342E', // Subtle border
        darktextMain: '#E8EBE9',   // Soft off-white, not stark
        darktextSec: '#8C9A90',    // Muted readable olive-grey

        // Legacy mapping to prevent breaking unmigrated screens
        avocado: '#9DCD8B',
        cream: '#F4F7F2',
        darkcream: '#1A1F1B',
        charcoal: '#24332D',
        darkcharcoal: '#F0F4EE',
        softgrey: '#F1F5EC',
        darkgrey: '#242B25',
        tomato: '#D97C6C',
        blueberry: '#4F7FFF',
      },
      fontFamily: {
        sans: ['GoogleSansFlex', 'sans-serif'],
      },
      fontSize: {
        'display': ['40px', { lineHeight: '1.1', fontWeight: '600' }], // Only for brand/hero
        'h1': ['32px', { lineHeight: '1.15', fontWeight: '500' }], // Page headings
        'h2': ['24px', { lineHeight: '1.2', fontWeight: '500' }], // Section headings
        'h3': ['20px', { lineHeight: '1.25', fontWeight: '500' }], // Card titles
        'h4': ['16px', { lineHeight: '1.3', fontWeight: '500' }], // Labels
        'body-lg': ['18px', { lineHeight: '1.5', fontWeight: '400' }],
        'body': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      borderRadius: {
        '3xl': '24px',
        '4xl': '32px',
        '5xl': '40px',
      },
      boxShadow: {
        'sm': '0 2px 8px rgba(0, 0, 0, 0.02)',
        'md': '0 4px 12px rgba(0, 0, 0, 0.03)',
        'lg': '0 8px 24px rgba(0, 0, 0, 0.04)',
        'xl': '0 12px 32px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
