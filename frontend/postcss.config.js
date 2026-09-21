// PostCSS plugin chain that Tailwind requires.
// `tailwindcss` expands Tailwind directives; `autoprefixer` adds vendor
// prefixes so older browsers still work without us writing them by hand.

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
