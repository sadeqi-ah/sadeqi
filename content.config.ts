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
    researchNotes: defineCollection({
      type: 'data',
      source: 'research/notes.yml',
      schema: z.object({
        items: z.array(z.object({ title: z.string(), href: z.string().optional() })),
      }),
    }),

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
        letterboxd: z.string().optional(),
        /** Spotify playlist URL — its tracks are listed on the home page. */
        playlist: z.string().optional(),
        watching: z.array(z.object({
          title: z.string(),
          kind: z.string(),
          rating: z.string(),
        })),
      }),
    }),

    site: defineCollection({
      type: 'data',
      source: 'site.yml',
      schema: z.object({
        name: z.string(),
        location: z.string(),
        timezone: z.string(),
        resumePdf: z.string().optional(),
        socials: z.object({
          email: z.string(),
          github: z.string(),
          x: z.string(),
          telegram: z.string(),
          instagram: z.string(),
        }),
      }),
    }),

    resume: defineCollection({
      type: 'data',
      source: 'resume.yml',
      schema: z.object({
        name: z.string(),
        role: z.string(),
        avatar: z.string().optional(),
        contact: z.array(link),
        summary: z.object({ network: z.string(), fullstack: z.string() }),
        experience: z.array(z.object({
          role: z.string(),
          org: z.string(),
          period: z.string(),
          tracks: z.array(z.enum(['network', 'fullstack'])),
          bullets: z.array(z.string()),
        })),
        education: z.array(z.object({ degree: z.string(), school: z.string(), period: z.string() })),
        skills: z.array(z.object({
          group: z.string(),
          tracks: z.array(z.enum(['network', 'fullstack'])),
          items: z.array(z.string()),
        })),
        languages: z.array(z.object({ name: z.string(), level: z.string() })),
      }),
    }),
  },
})
