/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          terracotta: '#C85A32',
          clayDark: '#B84A24',
          clayLight: '#F5EFEB',
          canvas: '#FDFBF7'
        },
        accent: {
          sage: '#4A6B53',
          sageLight: '#EAF0EB',
          ochre: '#D99B26',
          ochreLight: '#FEF8EA'
        },
        earth: {
          slate: '#1E2229',
          muted: '#6B7280',
          border: '#E8E2D9'
        },
        ink: "#1E2229",
        paper: "#FDFBF7",
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        editorial: ['Fraunces', 'serif'],
        sans: ['Plus Jakarta Sans', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(78, 53, 36, 0.05)',
      },
    },
  },
  plugins: [],
};
