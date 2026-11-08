export function useSite() {
  return useAsyncData('site', () => queryCollection('site').first(), { dedupe: 'defer' })
}

export const usePalette = () => useState('palette-open', () => false)
