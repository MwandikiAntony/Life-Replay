/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette
        void: '#080810',
        surface: '#0f0f1a',
        panel: '#14141f',
        border: '#1e1e2e',
        muted: '#2a2a3d',
        // Accent
        cyan: {
          DEFAULT: '#00d4ff',
          dim: '#00a8cc',
          glow: 'rgba(0,212,255,0.15)',
        },
        violet: {
          DEFAULT: '#7c3aed',
          bright: '#9f6ef7',
          glow: 'rgba(124,58,237,0.2)',
        },
        emerald: {
          DEFAULT: '#00c896',
          glow: 'rgba(0,200,150,0.15)',
        },
        amber: {
          DEFAULT: '#f59e0b',
          glow: 'rgba(245,158,11,0.15)',
        },
        rose: {
          DEFAULT: '#f43f5e',
          glow: 'rgba(244,63,94,0.15)',
        },
        // Text
        text: {
          primary: '#f0f0ff',
          secondary: '#8888aa',
          tertiary: '#555570',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui'],
        body: ['var(--font-body)', 'system-ui'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)`,
        'radial-glow': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0,212,255,0.3), 0 0 60px rgba(0,212,255,0.1)',
        'glow-violet': '0 0 20px rgba(124,58,237,0.3), 0 0 60px rgba(124,58,237,0.1)',
        'glow-emerald': '0 0 20px rgba(0,200,150,0.3)',
        'panel': '0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.4)',
        'panel-hover': '0 0 0 1px rgba(0,212,255,0.2), 0 8px 32px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 4s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'recording': 'recording 1.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0,212,255,0.4)' },
          '50%': { boxShadow: '0 0 20px rgba(0,212,255,0.8), 0 0 40px rgba(0,212,255,0.3)' },
        },
        recording: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.95)' },
        },
      },
      borderRadius: {
        'xl2': '1rem',
        'xl3': '1.25rem',
      },
    },
  },
  plugins: [],
};
