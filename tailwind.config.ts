import type { Config } from 'tailwindcss';
import uiPreset from '@matthewsreis/ui/tailwind-preset';

const config: Config = {
  // The @matthewsreis/ui preset wires primary/textcolor/default/success/danger
  // and the rest of the Artemis token scale to the CSS variables defined in
  // globals.css (.light theme).
  presets: [uiPreset as Partial<Config>],
  darkMode: 'selector',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    // Generate the utility classes the installed UI components reference.
    './node_modules/@matthewsreis/ui/dist/**/*.{js,cjs}'
  ],
  theme: {
    extend: {
      fontFamily: {
        // Satoshi is the Matthews design-system face (loaded via @font-face).
        sans: ['Satoshi', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['Satoshi', 'var(--font-inter)', 'system-ui', 'sans-serif']
      },
      colors: {
        // ── Matthews light-content palette (exact Theseus token values) ──
        mx: {
          page: '#FFFFFF',
          line: '#ECEEF1',
          lineSoft: '#F2F3F5',
          hover: '#F5F6F8',
          title: '#15171C',
          body: '#3F434B',
          secondary: '#6B7280',
          muted: '#8A909A',
          label: '#9AA1AC',
          field: '#D9DDE3',
          fieldHover: '#B9C0CA',
          blue: '#4380F3',
          blueDeep: '#2F60E8',
          blueWash: 'rgba(67,128,243,0.10)',
          link: '#2F6BE8',
          green: '#1D9669',
          greenBg: '#E7F6EF',
          red: '#D82F2F',
          redBg: '#FDECEC',
          amber: '#E0A106',
          amberBg: '#FBF3DD',
          teal: '#219387',
          dotRed: '#E5484B',
          dotAmber: '#E5A50A',
          dotGreen: '#22B07A',
          dotTeal: '#219387',
          dotGrey: '#C4C8CE'
        },
        // ── Dark navigation surface (sidebar) ──
        navy: {
          DEFAULT: '#0F172A',
          border: '#1D293C',
          sub: '#7AA2F7'
        },
        // ── Legacy tokens repointed to light values so any analytics surface
        //    that hasn't been fully reskinned stays readable on white. ──
        ink: {
          DEFAULT: '#15171C',
          dim: '#6B7280',
          mute: '#8A909A'
        },
        surface: {
          0: '#FFFFFF',
          1: '#FFFFFF',
          2: '#F5F6F8'
        },
        brand: {
          sky: '#4380F3',
          sky2: '#2F60E8',
          sky3: '#2F6BE8',
          violet: '#6563EE'
        },
        platform: {
          spotify: '#1DB954',
          captivate: '#00C2A5',
          youtube: '#FF0033',
          instagram: '#E1306C',
          tiktok: '#111111',
          linkedin: '#0A66C2',
          x: '#111111'
        }
      },
      boxShadow: {
        glow: '0 1px 2px rgba(47,96,232,0.25)',
        card: '0 1px 2px rgba(20,23,28,0.04)',
        cardHover: '0 4px 16px rgba(20,23,28,0.08)'
      },
      animation: {
        'pulse-dot': 'pulseDot 2.5s ease-in-out infinite'
      },
      keyframes: {
        pulseDot: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.4' }
        }
      }
    }
  },
  plugins: []
};

export default config;
