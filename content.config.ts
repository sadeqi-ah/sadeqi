import { defineCollection, defineContentConfig, z } from '@nuxt/content'

const link = z.object({
  label: z.string(),
  href: z.string().optional(),
})

export default defineContentConfig({
  collections: {
    // Free-form markdown pages written with MDC (e.g. the home intro).
    pages: defineCollection({
      type: 'page',
      source: 'pages/*.md',
    }),

    posts: defineCollection({
      type: 'page',
      source: 'writing/*.md',
      schema: z.object({
        date: z.string(),
        tags: z.array(z.string()).default([]),
        pinned: z.boolean().default(false),
        draft: z.boolean().default(false),
        readingTime: z.number().optional(),
      }),
    }),

    projects: defineCollection({
      type: 'data',
      source: 'projects/*.yml',
      schema: z.object({
        title: z.string(),
        short: z.string(),
        description: z.string(),
        year: z.string(),
        category: z.enum(['network', 'desktop', 'web', 'labs']),
        stack: z.array(z.string()),
        links: z.array(link).default([]),
        thumbnail: z.string().optional(),
        /** square logo/app icon (e.g. /projects/tray-speed.svg); a monogram tile is shown without one */
        logo: z.string().optional(),
        order: z.number().default(0),
      }),
    }),

    papers: defineCollection({
      type: 'data',
      source: 'research/papers/*.yml',
      schema: z.object({
        title: z.string(),
        status: z.string(),
        venue: z.string(),
        year: z.number(),
        authors: z.string(),
        links: z.array(link).default([]),
        featured: z.boolean().default(false),
      }),
    }),

    // Single-file data collections
    now: defineCollection({
      type: 'data',
      source: 'now.yml',
      schema: z.object({
        updated: z.string(),
        items: z.array(z.object({
          title: z.string(),
          meta: z.string(),
          progress: z.number().min(0).max(100),
          active: z.boolean().default(false),
        })),
      }),
    }),

    media: defineCollection({
      type: 'data',
      source: 'media.yml',
      schema: z.object({
        /** Spotify playlist URL — its tracks are listed on the home page. */
        playlist: z.string().optional(),
        /** Favourite films & series; posters are looked up by title (server/api/favourites). */
        favourites: z.array(z.object({
          title: z.string(),
          kind: z.enum(['film', 'series']),
          /** shown under the title, e.g. "2014" or "S1–S5" */
          note: z.string().optional(),
          /** helps pick the right film when titles repeat */
          year: z.number().optional(),
          rating: z.string().optional(),
          url: z.string().optional(),
          /** poster override, if the lookup picks the wrong one */
          cover: z.string().optional(),
        })).default([]),
      }),
    }),

    site: defineCollection({
      type: 'data',
      source: 'site.yml',
      schema: z.object({
        name: z.string(),
        location: z.string(),
        timezone: z.string(),
        socials: z.object({
          email: z.string(),
          github: z.string(),
          x: z.string(),
          telegram: z.string(),
          instagram: z.string(),
        }),
      }),
    }),

  },
})
