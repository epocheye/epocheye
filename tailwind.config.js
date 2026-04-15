/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Heritage-dark brand surfaces. Use these instead of hardcoded hex.
        ink: {
          DEFAULT: '#0A0A0A', // page background
          deep: '#000000',
          warm: '#080604',
        },
        surface: {
          1: '#141414', // cards
          2: '#1C1C1C', // elevated
          3: '#262626', // pressed / inner
        },
        brand: {
          gold: '#C9A84C',
          goldSoft: '#D4C5A0',
          amber: '#D4860A',
          amberLight: '#E8A33A',
          amberDark: '#B06F08',
        },
        parchment: {
          DEFAULT: '#F5F0E8', // primary body text on dark
          muted: '#B8AF9E',
          dim: '#6B6357',
          faint: '#8F8576',
        },
        status: {
          success: '#10B981',
          danger: '#EF4444',
          warning: '#E05C5C',
        },
      },
      boxShadow: {
        'gold-glow': '0 0 24px rgba(201,168,76,0.25)',
        'amber-glow': '0 0 32px rgba(212,134,10,0.35)',
      },
      fontFamily: {
        'montserrat': ['MontserratAlternates-Regular'],
        'montserrat-thin': ['MontserratAlternates-Thin'],
        'montserrat-thin-italic': ['MontserratAlternates-ThinItalic'],
        'montserrat-extralight': ['MontserratAlternates-ExtraLight'],
        'montserrat-extralight-italic': ['MontserratAlternates-ExtraLightItalic'],
        'montserrat-light': ['MontserratAlternates-Light'],
        'montserrat-light-italic': ['MontserratAlternates-LightItalic'],
        'montserrat-italic': ['MontserratAlternates-Italic'],
        'montserrat-medium': ['MontserratAlternates-Medium'],
        'montserrat-medium-italic': ['MontserratAlternates-MediumItalic'],
        'montserrat-semibold': ['MontserratAlternates-SemiBold'],
        'montserrat-semibold-italic': ['MontserratAlternates-SemiBoldItalic'],
        'montserrat-bold': ['MontserratAlternates-Bold'],
        'montserrat-bold-italic': ['MontserratAlternates-BoldItalic'],
        'montserrat-extrabold': ['MontserratAlternates-ExtraBold'],
        'montserrat-extrabold-italic': ['MontserratAlternates-ExtraBoldItalic'],
        'montserrat-black': ['MontserratAlternates-Black'],
        'montserrat-black-italic': ['MontserratAlternates-BlackItalic'],
      },
    },
  },
  plugins: [],
}