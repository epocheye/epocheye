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
          DEFAULT: '#050505', // page background
          deep: '#020202',
          warm: '#111111',
        },
        surface: {
          1: '#0A0A0A', // cards
          2: '#141414', // elevated
          3: '#1C1C1C', // pressed / inner
        },
        brand: {
          // Keys kept (gold/goldSoft/amber) so existing classNames compile.
          // Values repointed to Figma sky/lime palette.
          gold: '#61A6D3',
          goldSoft: '#8FC3E2',
          amber: '#61A6D3',
          amberLight: '#8FC3E2',
          amberDark: '#4A86B0',
          sky: '#61A6D3',
          skyLight: '#8FC3E2',
          skyDark: '#4A86B0',
          lime: '#8EC24B',
          limeDark: '#6FA037',
        },
        parchment: {
          DEFAULT: '#FFFFFF', // primary body text on dark
          muted: 'rgba(255,255,255,0.72)',
          dim: 'rgba(255,255,255,0.45)',
          faint: 'rgba(255,255,255,0.28)',
        },
        status: {
          success: '#10B981',
          danger: '#EF4444',
          warning: '#E05C5C',
        },
      },
      boxShadow: {
        'gold-glow': '0 0 24px rgba(97,166,211,0.25)',
        'amber-glow': '0 0 32px rgba(97,166,211,0.35)',
        'sky-glow': '0 0 24px rgba(97,166,211,0.3)',
        'lime-glow': '0 0 24px rgba(142,194,75,0.3)',
      },
      fontFamily: {
        'handwritten': ['NothingYouCouldDo-Regular'],
        'serif-italic': ['InstrumentSerif-Italic'],
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