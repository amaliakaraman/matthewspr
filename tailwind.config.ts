import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', '"Space Grotesk"', 'Inter', 'sans-serif']
      },
      colors: {
        ink: {
          DEFAULT: '#F8FAFF',
          dim: '#9BA8D0',
          mute: '#6B7596'
        },
        surface: {
          0: '#070A1A',
          1: '#0D1230',
          2: '#141A45'
        },
        brand: {
          sky: '#38BDF8',
          sky2: '#0EA5E9',
          sky3: '#0284C7',
          violet: '#7C3AED'
        },
        platform: {
          spotify: '#1DB954',
          captivate: '#00C2A5',
          youtube: '#FF0033',
          instagram: '#E1306C',
          tiktok: '#FE2C55',
          linkedin: '#0A66C2',
          x: '#FFFFFF'
        }
      },
      boxShadow: {
        glow: '0 8px 30px rgba(56,189,248,.4)',
        card: '0 24px 60px rgba(0,0,0,.55)'
      },
      animation: {
        'pulse-dot': 'pulseDot 2.5s ease-in-out infinite',
        'aurora': 'aurora 22s ease-in-out infinite'
      },
      keyframes: {
        pulseDot: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.4' }
        },
        aurora: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(8vw,-6vh) scale(1.15)' }
        }
      }
    }
  },
  plugins: []
};

export default config;
