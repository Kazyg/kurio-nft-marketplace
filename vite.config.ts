import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

function preloadApplication(): Plugin {
  let base = '/'
  return {
    name: 'preload-application',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const bundle = context.bundle
        if (!bundle) return []
        const mount = Object.values(bundle).find(
          (entry) =>
            entry.type === 'chunk' &&
            entry.facadeModuleId
              ?.replaceAll('\\', '/')
              .endsWith('/src/app/mount.tsx'),
        )
        if (!mount) return []
        const files = new Set<string>()
        function collect(fileName: string) {
          if (files.has(fileName)) return
          const entry = bundle?.[fileName]
          if (entry?.type !== 'chunk') return
          files.add(fileName)
          entry.imports.forEach(collect)
        }
        collect(mount.fileName)
        return [...files].map((fileName) => ({
          tag: 'link',
          attrs: {
            rel: 'modulepreload',
            href: `${base}${fileName}`,
            crossorigin: '',
          },
          injectTo: 'head',
        }))
      },
    },
  }
}

export default defineConfig({
  server: { hmr: process.env.E2E_TARGET === 'dev' ? false : undefined },
  plugins: [react(), tailwindcss(), preloadApplication()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
