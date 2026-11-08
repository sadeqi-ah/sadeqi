/**
 * Light / dark theme.
 *
 * The class (`dark` on <html>) is set before first paint by the THEME head
 * script in nuxt.config — the saved choice, else the OS preference — so this
 * only reads it back and flips it.
 *
 * Switching is a view transition: the browser snapshots the page, we swap the
 * class, and the new theme is revealed by a circle growing out of the point
 * that was clicked (clip-path on ::view-transition-new(root)). Browsers
 * without view transitions, and reduced-motion users, get an instant swap.
 */
type Theme = 'light' | 'dark'

const THEME_COLOR: Record<Theme, string> = { light: '#fafaf9', dark: '#0e0d0c' }

function apply(t: Theme) {
  const html = document.documentElement
  html.classList.toggle('dark', t === 'dark')
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
}

export function useTheme() {
  const theme = useState<Theme>('theme', () => 'light')

  onMounted(() => {
    theme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  /** @param from where the circle starts — the toggle's centre, or a click */
  async function toggle(from?: { x: number, y: number }) {
    const next: Theme = theme.value === 'dark' ? 'light' : 'dark'
    const commit = () => {
      theme.value = next
      apply(next)
      try { localStorage.setItem('theme', next) }
      catch {}
    }

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduced) return commit()

    const x = from?.x ?? innerWidth / 2
    const y = from?.y ?? 0
    // radius that reaches the farthest corner from (x, y)
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))

    const html = document.documentElement
    html.classList.add('theme-switching')
    const vt = document.startViewTransition(commit)
    try {
      await vt.ready
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        {
          duration: 700,
          easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      )
      await vt.finished
    }
    catch {} // transition skipped (e.g. tab hidden): the theme still changed
    finally {
      html.classList.remove('theme-switching')
    }
  }

  return { theme, toggle }
}
