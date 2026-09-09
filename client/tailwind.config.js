/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#00130d',
        'on-primary': '#ffffff',
        'primary-container': '#0f2922',
        'on-primary-container': '#769188',
        'surface': '#faf8ff',
        'surface-dim': '#d2d9f4',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f3ff',
        'surface-container': '#eaedff',
        'surface-container-high': '#e2e7ff',
        'on-surface': '#131b2e',
        'on-surface-variant': '#424845',
        'outline': '#727975',
        'outline-variant': '#c1c8c4',
        // Hazard Scale (NDMA/IMD 5-tier)
        'hazard-safe': '#15803d',
        'hazard-safe-bg': '#dcfce7',
        'hazard-low': '#ca8a04',
        'hazard-low-bg': '#fef9c3',
        'hazard-mod': '#ea580c',
        'hazard-mod-bg': '#ffedd5',
        'hazard-high': '#dc2626',
        'hazard-high-bg': '#fee2e2',
        'hazard-crit': '#991b1b',
        'hazard-crit-bg': '#ffe4e6',
        'secondary': '#006d30',
        'secondary-container': '#92f5a4'
      },
      fontFamily: {
        sans: ['"Public Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      }
    },
  },
  plugins: [],
}
