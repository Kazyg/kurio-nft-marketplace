import { env } from '@/shared/config/env'
export async function enableMocking() {
  if (env.VITE_ENABLE_MSW !== 'true') return
  const { worker } = await import('./browser')
  await worker.start({
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith('/api/')) print.error()
    },
  })
}
