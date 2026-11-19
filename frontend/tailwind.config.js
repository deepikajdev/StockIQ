/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surface and containers
        surface: '#faf8ff',
        'surface-dim': '#d2d9f4',
        'surface-bright': '#faf8ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f3ff',
        'surface-container': '#eaedff',
        'surface-container-high': '#e2e7ff',
        'surface-container-highest': '#dae2fd',
        'on-surface': '#131b2e',
        'on-surface-variant': '#464555',
        'inverse-surface': '#283044',
        'inverse-on-surface': '#eef0ff',
        outline: '#777587',
        'outline-variant': '#c7c4d8',
        'surface-tint': '#4d44e3',
        background: '#faf8ff',
        'on-background': '#131b2e',
        'surface-variant': '#dae2fd',

        // Primary Indigo
        primary: '#3525cd',
        'on-primary': '#ffffff',
        'primary-container': '#4f46e5',
        'on-primary-container': '#dad7ff',
        'inverse-primary': '#c3c0ff',
        'primary-fixed': '#e2dfff',
        'primary-fixed-dim': '#c3c0ff',
        'on-primary-fixed': '#0f0069',
        'on-primary-fixed-variant': '#3323cc',

        // Secondary Teal
        secondary: '#006a61',
        'on-secondary': '#ffffff',
        'secondary-container': '#86f2e4',
        'on-secondary-container': '#006f66',
        'secondary-fixed': '#89f5e7',
        'secondary-fixed-dim': '#6bd8cb',
        'on-secondary-fixed': '#00201d',
        'on-secondary-fixed-variant': '#005049',

        // Tertiary Amber / Warm
        tertiary: '#7e3000',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#a44100',
        'on-tertiary-container': '#ffd2be',
        'tertiary-fixed': '#ffdbcc',
        'tertiary-fixed-dim': '#ffb695',
        'on-tertiary-fixed': '#351000',
        'on-tertiary-fixed-variant': '#7b2f00',

        // Error / Status Red
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px',
      },
      spacing: {
        'space-xs': '0.25rem', // 4px
        'space-sm': '0.5rem',  // 8px
        'space-md': '1rem',    // 16px
        'space-lg': '1.5rem',  // 24px
        'space-xl': '2rem',    // 32px
        'space-2xl': '3rem',   // 48px
        gutter: '1rem',
        'gutter-desktop': '1.5rem',
        margin: '1rem',
        'margin-desktop': '2rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        'page-title': ['Inter', 'sans-serif'],
        'hero-metric': ['Inter', 'sans-serif'],
        'table-cell': ['Inter', 'sans-serif'],
        caption: ['Inter', 'sans-serif'],
        'section-title': ['Inter', 'sans-serif'],
        'body-medium': ['Inter', 'sans-serif'],
        'table-header': ['Inter', 'sans-serif'],
        lead: ['Inter', 'sans-serif'],
        'page-title-mobile': ['Inter', 'sans-serif'],
        'body-default': ['Inter', 'sans-serif'],
        overline: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'page-title': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'hero-metric': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'table-cell': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'section-title': ['20px', { lineHeight: '28px', letterSpacing: '-0.005em', fontWeight: '600' }],
        'body-medium': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'table-header': ['12px', { lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '600' }],
        lead: ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'page-title-mobile': ['22px', { lineHeight: '28px', fontWeight: '600' }],
        'body-default': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        overline: ['11px', { lineHeight: '14px', letterSpacing: '0.05em', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};
