/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
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