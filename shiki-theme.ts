// Quiet, near-monochrome Shiki themes built from the site's design tokens:
// keys/keywords in the accent blue, strings a warm grey, comments muted.
// `paper` is the light theme, `paperDark` its dark-mode twin (main.css swaps
// them on html.dark).
function theme(name: string, type: 'light' | 'dark', c: Record<'bg' | 'fg' | 'comment' | 'key' | 'string' | 'number' | 'punct', string>) {
  return {
    name,
    type,
    colors: {
      'editor.background': c.bg,
      'editor.foreground': c.fg,
    },
    tokenColors: [
      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: c.comment, fontStyle: 'italic' } },
      {
        scope: ['entity.name.tag', 'keyword', 'storage', 'storage.type', 'support.type.property-name', 'meta.object-literal.key', 'variable.other.property'],
        settings: { foreground: c.key },
      },
      { scope: ['string', 'string.quoted', 'string.unquoted'], settings: { foreground: c.string } },
      { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: c.number } },
      { scope: ['entity.name.function', 'support.function'], settings: { foreground: c.fg, fontStyle: 'bold' } },
      { scope: ['punctuation', 'meta.brace', 'keyword.operator'], settings: { foreground: c.punct } },
    ],
  }
}

export default theme('paper', 'light', {
  bg: '#f0f0ee', fg: '#111111', comment: '#a8a29e', key: '#2563eb', string: '#44403c', number: '#b45309', punct: '#78716c',
})

export const paperDark = theme('paper-dark', 'dark', {
  bg: '#1c1a18', fg: '#f2f0ed', comment: '#6f6964', key: '#6ea8ff', string: '#cfc9c2', number: '#f0a050', punct: '#a39d97',
})
