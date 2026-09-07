// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxtjs/supabase', '@vite-pwa/nuxt'],

  nitro: {
    preset: 'cloudflare_pages',
    cloudflare: {
      nodeCompat: true,
    },
  },

  supabase: {
    // Point the module at our hand-written Database type. When a live
    // Supabase project is connected this can be regenerated via
    // `supabase gen types typescript --project-id <id>` and the file
    // can simply be overwritten — the shape is a drop-in replacement.
    types: '~/types/database',
    redirect: false, // We handle auth redirect in middleware
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
    },
  },

  pwa: {
    manifest: {
      name: 'Voc — Vocabulary Review',
      short_name: 'Voc',
      description: 'Capture and review English vocabulary with spaced repetition',
      theme_color: '#0f172a',
      background_color: '#0f172a',
      display: 'standalone',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/icons/icon-512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
    },
  },

  runtimeConfig: {
    // SUPABASE_SERVICE_ROLE_KEY is private (server-only)
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  },
})
