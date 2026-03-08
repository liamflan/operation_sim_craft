/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        avocado: '#6DBE75',
        cream: '#FFF6E9',
        tomato: '#FF6B5A',
        blueberry: '#4F7FFF',
        charcoal: '#2C2C2C',
        softgrey: '#F2F2F2'
      },
      fontFamily: {
        sans: ['Outfit_400Regular', 'sans-serif'],
        medium: ['Outfit_500Medium', 'sans-serif'],
        bold: ['Outfit_700Bold', 'sans-serif'],
        extrabold: ['Outfit_800ExtraBold', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

