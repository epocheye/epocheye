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
        accent: {
          amber: '#E8A020',
          amberDark: '#D4860A',
          amberSoft: 'rgba(232,160,32,0.14)',
          amberBorder: 'rgba(232,160,32,0.35)',
          amberSubtle: 'rgba(232,160,32,0.08)',
        },
        grey: {
          muted: '#8C93A0',
          border: '#2A2A2A',
          subtle: '#1A1A1A',
          dark: '#0D0D0D',
        },
        overlay: {
          dark: 'rgba(0,0,0,0.6)',
          medium: 'rgba(0,0,0,0.4)',
          light: 'rgba(0,0,0,0.2)',
        },
        // Onboarding "Through the Lens" design system tokens
        ob: {
          bgDeep: '#07060C',
          bgWarm: '#0C0906',
          bgStone: '#1A1714',
          bgDisabled: '#1E1C17',
          glass: 'rgba(255,255,255,0.055)',
          glassHover: 'rgba(255,255,255,0.085)',
          glassStrong: 'rgba(255,255,255,0.11)',
          glassWarm: 'rgba(201,168,76,0.06)',
          borderSubtle: 'rgba(255,255,255,0.07)',
          borderMedium: 'rgba(255,255,255,0.12)',
          borderStrong: 'rgba(255,255,255,0.20)',
          gold: '#C9A84C',
          goldLight: '#E0C06A',
          goldDark: '#9A7828',
          goldText: '#D4B05A',
          goldGlow: 'rgba(201,168,76,0.35)',
          goldSubtle: 'rgba(201,168,76,0.09)',
          goldSoft: 'rgba(201,168,76,0.15)',
          goldFaint: 'rgba(201,168,76,0.04)',
          goldBorder: 'rgba(201,168,76,0.35)',
          goldBorderStrong: 'rgba(201,168,76,0.70)',
          warm: '#F4EFE8',
          warmSoft: 'rgba(244,239,232,0.65)',
          warmMuted: 'rgba(244,239,232,0.40)',
          warmDim: 'rgba(244,239,232,0.22)',
          dark: '#0A0808',
          indigo: '#8B9FE8',
          indigoSubtle: 'rgba(139,159,232,0.12)',
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
        // Instrument family — primary for redesigned screens (serif for
        // titles/headings, sans for body/UI).
        'instrument-serif': ['InstrumentSerif-Regular'],
        'instrument-serif-italic': ['InstrumentSerif-Italic'],
        'instrument': ['InstrumentSans-Regular'],
        'instrument-medium': ['InstrumentSans-Medium'],
        'instrument-semibold': ['InstrumentSans-SemiBold'],
        'instrument-bold': ['InstrumentSans-Bold'],
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