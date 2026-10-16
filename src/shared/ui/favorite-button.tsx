import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { rememberFavorite, consumeFavorite } from '@/shared/lib/auth-intent'
import { safeReturnTo } from '@/shared/lib/redirect'
import { Heart } from 'lucide-react'
import { isAxiosError } from 'axios'
import {
  useFavorites,
  useSession,
  useToggleFavorite,
} from '@/shared/api/marketplace-hooks'
import type { Nft } from '@/shared/contracts/marketplace'
import { LoginDialog } from './login-dialog'
import { apiErrorMessage as errorMessage } from '@/shared/api/marketplace'

export function FavoriteButton({
  nft,
  text = false,
}: {
  nft: Nft
  text?: boolean
}) {
  const session = useSession()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const [login, setLogin] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const mutate = toggle.mutate
  useEffect(() => {
    if (session.data?.user && consumeFavorite(nft.id, location.pathname))
      mutate({ nftId: nft.id, favorite: true })
  }, [session.data?.user, nft.id, location.pathname, mutate])
  function requestLogin() {
    if (window.matchMedia('(max-width: 767px)').matches) {
      rememberFavorite(nft.id, location.pathname)
      void navigate({
        to: '/login',
        search: { redirect: safeReturnTo(location.href) },
      })
    } else setLogin(true)
  }
  const favorite = favorites.data?.nftIds.includes(nft.id) ?? false
  function act() {
    toggle.mutate(
      { nftId: nft.id, favorite: !favorite },
      {
        onError: (error) => {
          if (isAxiosError(error) && error.response?.status === 401)
            requestLogin()
        },
      },
    )
  }
  return (
    <>
      <button
        className={`favorite-button ${text ? 'with-text' : ''} ${favorite ? 'is-favorite' : ''}`}
        aria-pressed={favorite}
        aria-label={`Favoritar ${nft.name}`}
        disabled={toggle.isPending}
        onClick={() => (session.data?.user ? act() : requestLogin())}
      >
        <Heart size={21} fill={favorite ? 'currentColor' : 'none'} />
        {text && 'Favoritar'}
      </button>
      <LoginDialog open={login} onOpenChange={setLogin} onSuccess={act} />
      {toggle.isError && (
        <span role="alert" className="inline-error">
          {errorMessage(toggle.error)}
        </span>
      )}
    </>
  )
}
