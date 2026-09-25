import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#faf7f3', // Background 1
          900: '#f7f2ec', // Background 2
          800: '#fffdf9', // Background 3 (Elevated card)
          700: '#f5eee6', // Subtle inputs/pills
          600: 'rgba(176, 122, 77, 0.14)', // Border color
        },
        slate: {
          50: '#fffdfb',
          100: '#fbf9f6',
          200: '#f6f2ec',
          300: '#eadecf',
          400: '#8f8175', // Text muted (Text 3)
          500: '#8f8175', // Text 3
          600: '#6b5b4d', // Text secondary (Text 2)
          700: '#6b5b4d', // Text 2
          800: '#2b2622', // Text primary (Text 1)
          900: '#2b2622', // Text 1
          950: '#1c1917',
        },
        accent: {
          cyan: '#9a6a43',    // Primary Accent
          caramel: '#b07a4d', // Secondary Accent
          amber: '#f1c04e',   // Medium score
          rose: '#f0a03c',    // High score
          emerald: '#93ab68', // Low score / Success
          danger: '#e16a4f',  // Critical score
          bronze: '#8b6c4f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderRadius: {
        '3xl': '24px', // Premium rounded cards (Requirement 3)
        '2xl': '16px', // Rounded buttons
        'xl': '12px',  // Rounded inputs
        'lg': '10px',
        'md': '8px',
      },
      backdropBlur: {
        glass: '16px',
      },
      boxShadow: {
        glass: '0 10px 30px -10px rgba(139, 115, 85, 0.08), 0 1px 1px rgba(255, 255, 255, 0.8) inset',
        premium: '0 20px 40px -15px rgba(61, 47, 34, 0.05), 0 1px 3px rgba(139, 115, 85, 0.03)',
      },
    },
  },
  plugins: [],
};

export default config;
