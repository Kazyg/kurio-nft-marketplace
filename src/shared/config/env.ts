import { z } from 'zod'
export const env = z
  .object({
    VITE_ENABLE_MSW: z.enum(['true', 'false']).default('false'),
    VITE_API_BASE_URL: z.string().default('/api'),
    VITE_SOCKET_URL: z.string().default(''),
  })
  .parse(import.meta.env)
