// Tailwind CSS configuration.
// We tell Tailwind which files to scan for class names so that only the
// classes actually used end up in the final CSS bundle.

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      // Project's brand palette — dark blue primary, accent gold.
      // Matches the dissertation system's PDF header colour.
      colors: {
        brand: {
          DEFAULT: '#2c3e50',
          light: '#34495e',
          dark: '#1a252f',
        },
        accent: '#f1c40f',
      },
    },
  },
  plugins: [],
};
