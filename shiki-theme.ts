// A quiet, near-monochrome Shiki theme built from the site's design tokens:
// keys/keywords in the accent blue, strings a warm dark grey, comments muted.
export default {
  name: 'paper',
  type: 'light',
  colors: {
    'editor.background': '#f0f0ee',
    'editor.foreground': '#111111',
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#a8a29e', fontStyle: 'italic' } },
    {
      scope: ['entity.name.tag', 'keyword', 'storage', 'storage.type', 'support.type.property-name', 'meta.object-literal.key', 'variable.other.property'],
      settings: { foreground: '#2563eb' },
    },
    { scope: ['string', 'string.quoted', 'string.unquoted'], settings: { foreground: '#44403c' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: '#b45309' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#111111', fontStyle: 'bold' } },
    { scope: ['punctuation', 'meta.brace', 'keyword.operator'], settings: { foreground: '#78716c' } },
  ],
}
