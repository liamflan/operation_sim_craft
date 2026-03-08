/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
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

