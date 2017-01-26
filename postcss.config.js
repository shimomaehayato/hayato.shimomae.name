module.exports = (ctx) => ({
  from: ctx.from,
  plugins: {
    'postcss-import': {},
    'postcss-custom-properties': {},
    cssnano: {}
  }
});
