import { redirect } from '@tanstack/react-router'
import { queryClient } from '@/shared/api/query-client'
import { marketplaceApi } from '@/shared/api/marketplace'
import { marketKeys } from '@/shared/api/marketplace-hooks'
import { safeReturnTo } from '@/shared/lib/redirect'

export async function requireSession({
  location,
}: {
  location: { href: string }
}) {
  const session = await queryClient.fetchQuery({
    queryKey: marketKeys.session,
    queryFn: ({ signal }) => marketplaceApi.session(signal),
    staleTime: 0,
  })
  if (!session.user)
    throw redirect({
      to: '/login',
      search: { redirect: safeReturnTo(location.href) },
      replace: true,
    })
}
