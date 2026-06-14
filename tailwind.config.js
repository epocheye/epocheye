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
          DEFAULT: '#0A0A0C', // page background (premium warm-black)
          deep: '#060608',
          warm: '#131218',
        },
        surface: {
          1: '#131218', // cards
          2: '#1A1822', // elevated
          3: '#201E29', // pressed / inner
        },
        brand: {
          // Keys kept (gold/goldSoft/amber/sky) so existing classNames compile.
          // Values repointed to the premium antique-gold palette.
          gold: '#CBA862',
          goldSoft: '#E6C88B',
          amber: '#CBA862',
          amberLight: '#E6C88B',
          amberDark: '#B8923F',
          sky: '#CBA862',
          skyLight: '#E6C88B',
          skyDark: '#B8923F',
          lime: '#C9A24B',
          limeDark: '#A8843A',
        },
        parchment: {
          DEFAULT: '#F4EFE7', // primary body text on dark (warm parchment)
          muted: 'rgba(244,239,231,0.70)',
          dim: 'rgba(244,239,231,0.45)',
          faint: 'rgba(244,239,231,0.28)',
        },
        status: {
          success: '#10B981',
          danger: '#EF4444',
          warning: '#E05C5C',
        },
        accent: {
          amber: '#CBA862',
          amberDark: '#B8923F',
          amberSoft: 'rgba(203,168,98,0.14)',
          amberBorder: 'rgba(203,168,98,0.35)',
          amberSubtle: 'rgba(203,168,98,0.08)',
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
        // Figma "Site Details" / "AI Guide (Dark)" palette — terracotta + cream.
        // Pulled directly from frames 238:33 and 240:3.
        warm: {
          deep: '#0F0A05', // page background for both redesigned screens
        },
        terracotta: {
          DEFAULT: '#B8551A', // primary CTA fill
          dark: '#8B3F12', // gradient top
          flame: '#D4691F', // waveform + mic accent
        },
        peach: '#FFD4BB', // secondary CTA fill
        cream: {
          DEFAULT: '#FFFFFF', // white info cards / assistant bubble
          border: '#E8DDD0', // card hairline
        },
        stone: {
          label: '#9E8F7A', // BUILT / DYNASTY labels
          desc: '#6B5D4F', // italic description
          ink: '#1F1611', // dark text on cream / chip fill
        },
        guide: {
          line: '#2D2218', // dividers + chip borders
          cream: '#F2EBE0', // primary text on AI guide
          muted: '#A89685', // status / secondary text
        },
        arready: {
          bg: '#FFD7D7', // faithful Figma AR Ready badge (pink/red)
          fg: '#FF0000',
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
        'gold-glow': '0 0 24px rgba(203,168,98,0.25)',
        'amber-glow': '0 0 32px rgba(203,168,98,0.35)',
        'sky-glow': '0 0 24px rgba(203,168,98,0.3)',
        'lime-glow': '0 0 24px rgba(203,168,98,0.28)',
      },
      fontFamily: {
        // Premium pairing (heritage-gold redesign).
        'display': ['CormorantGaramond-SemiBold'],
        'display-regular': ['CormorantGaramond-Regular'],
        'ui': ['DMSans-Regular'],
        'ui-medium': ['DMSans-Medium'],
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