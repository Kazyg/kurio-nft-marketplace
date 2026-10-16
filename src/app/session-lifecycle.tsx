import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { marketKeys, useSession } from '@/shared/api/marketplace-hooks'
import { clearPrivateCache } from '@/shared/api/private-cache'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { safeReturnTo } from '@/shared/lib/redirect'
import { getAccessToken } from '@/shared/api/identity'

export function SessionLifecycle() {
  const client = useQueryClient()
  const session = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    async function refreshIdentity(cancelSession: boolean) {
      if (cancelSession)
        await client.cancelQueries({ queryKey: marketKeys.session })
      await clearPrivateCache(client)
      await client.invalidateQueries(
        { queryKey: marketKeys.session },
        { cancelRefetch: false },
      )
    }
    const onExpiry = () => {
      void refreshIdentity(false)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'kurio.accessToken' || event.key === null)
        void refreshIdentity(true)
    }
    window.addEventListener('kurio:session-expired', onExpiry)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('kurio:session-expired', onExpiry)
      window.removeEventListener('storage', onStorage)
    }
  }, [client])
  useEffect(() => {
    if (!session.data?.expiresAt) return
    const timeout = window.setTimeout(
      () => {
        void client.invalidateQueries(
          { queryKey: marketKeys.session },
          { cancelRefetch: false },
        )
      },
      Math.max(0, Date.parse(session.data.expiresAt) - Date.now()) + 100,
    )
    return () => window.clearTimeout(timeout)
  }, [client, session.data?.expiresAt])
  useEffect(() => {
    const privatePath =
      /^\/(profile|wallets|favorites|orders|checkout)(?:\/|$)/.test(
        location.pathname,
      )
    if (
      privatePath &&
      ((session.isSuccess && !session.data.user) ||
        (session.isError && !getAccessToken()))
    ) {
      void navigate({
        to: '/login',
        search: { redirect: safeReturnTo(location.href) },
        replace: true,
      })
    }
  }, [
    location.pathname,
    location.href,
    navigate,
    session.isSuccess,
    session.isError,
    session.data?.user,
  ])
  return null
}
