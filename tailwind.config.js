/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Barnard brand — refined into usable scales.
        brand: {
          50: '#EAF2FA',
          100: '#CBDEF0',
          200: '#9CC0E1',
          300: '#5E97C9',
          400: '#2A73AE',
          500: '#0A6FB8',
          600: '#005E9E',
          700: '#004E89', // primary brand blue
          800: '#003C6B',
          900: '#002B4D',
        },
        accent: {
          50: '#FFF3ED',
          100: '#FFE0D1',
          200: '#FFC0A3',
          300: '#FF9B6E',
          400: '#FF7E45',
          500: '#FF6B35', // brand orange
          600: '#F2530F',
          700: '#C7400A',
        },
        // Neutral surface palette for an elegant, modern UI.
        surface: '#FFFFFF',
        canvas: '#F4F6F9',
        ink: '#0F1B2D',
        muted: '#6B7A90',
        line: '#E6EBF1',
        // Backwards-compatible aliases used across existing screens.
        construction: {
          orange: '#FF6B35',
          dark: '#004E89',
          light: '#F4F6F9',
          accent: '#FFB627',
        },
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
      },
    },
  },
  plugins: [],
};
