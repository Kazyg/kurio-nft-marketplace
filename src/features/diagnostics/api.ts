import { queryOptions } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { diagnosticSchema } from './contracts'
export const diagnosticKeys = {
  all: ['diagnostics'] as const,
  http: () => [...diagnosticKeys.all, 'http'] as const,
}
export const diagnosticQuery = queryOptions({
  queryKey: diagnosticKeys.http(),
  queryFn: async () =>
    diagnosticSchema.parse((await api.get<unknown>('/diagnostics')).data),
})
