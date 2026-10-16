import type { QueryClient } from '@tanstack/react-query'

export const privateQueryRoots = [
  'favorites',
  'cart',
  'quotes',
  'profile',
  'wallets',
  'orders',
] as const
export async function clearPrivateCache(client: QueryClient) {
  await Promise.all(
    privateQueryRoots.map((key) => client.cancelQueries({ queryKey: [key] })),
  )
  for (const key of privateQueryRoots) client.removeQueries({ queryKey: [key] })
}
