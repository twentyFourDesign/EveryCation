const { tailwindColors } = require('./tokens.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tailwindColors,
      fontFamily: {
        pop: ['Poppins_400Regular'],
        'pop-md': ['Poppins_500Medium'],
        'pop-sb': ['Poppins_600SemiBold'],
        'pop-b': ['Poppins_700Bold'],
      },
      borderRadius: { card: '20px' },
    },
  },
};
