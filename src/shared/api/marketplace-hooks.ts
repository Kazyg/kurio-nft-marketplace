import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  CartItemInput,
  CatalogSearch,
  Favorites,
  LoginInput,
  RegisterInput,
  Session,
  SocialLoginInput,
  PasswordInput,
  ProfileInput,
  WalletInput,
  Cart,
  Nft,
  NftList,
  Network,
} from '@/shared/contracts/marketplace'
import { marketplaceApi } from './marketplace'
import {
  clearAccessToken,
  getAccessToken,
  getGuestId,
  setAccessToken,
} from './identity'
import { clearPrivateCache } from './private-cache'
import { clearAuthIntent } from '@/shared/lib/auth-intent'
import {
  latestCart,
  latestCatalog,
  latestNft,
} from '@/shared/realtime/reconcile'

export const marketKeys = {
  catalog: ['catalog'] as const,
  list: (search: CatalogSearch) => ['catalog', 'list', search] as const,
  content: ['catalog', 'content'] as const,
  nft: (id: string) => ['nft', id] as const,
  session: ['auth', 'session'] as const,
  favorites: (userId: string | undefined) => ['favorites', userId] as const,
  cart: (ownerId: string) => ['cart', ownerId] as const,
  profile: (userId?: string) => ['profile', userId] as const,
  wallets: (userId?: string) => ['wallets', userId] as const,
}

export function useCatalog(search: CatalogSearch) {
  return useQuery({
    queryKey: marketKeys.list(search),
    queryFn: ({ signal }) => marketplaceApi.list(search, signal),
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[2] as CatalogSearch | undefined)?.collection ===
      search.collection
        ? previous
        : undefined,
    structuralSharing: (previous, next) =>
      latestCatalog(previous as NftList | undefined, next as NftList),
  })
}
export function useCatalogContent() {
  return useQuery({
    queryKey: marketKeys.content,
    queryFn: ({ signal }) => marketplaceApi.content(signal),
  })
}
export function useNft(id: string) {
  return useQuery({
    queryKey: marketKeys.nft(id),
    queryFn: ({ signal }) => marketplaceApi.nft(id, signal),
    structuralSharing: (previous, next) =>
      latestNft(previous as Nft | undefined, next as Nft),
  })
}
export function useSession() {
  return useQuery({
    queryKey: marketKeys.session,
    queryFn: ({ signal }) => marketplaceApi.session(signal),
    staleTime: 30_000,
  })
}
export function useFavorites() {
  const session = useSession()
  return useQuery({
    queryKey: marketKeys.favorites(session.data?.user?.id),
    queryFn: ({ signal }) => marketplaceApi.favorites(signal),
    enabled: !!session.data?.user,
  })
}
export function useCart() {
  const session = useSession()
  return useQuery({
    queryKey: marketKeys.cart(session.data?.user?.id || getGuestId()),
    queryFn: ({ signal }) => marketplaceApi.cart(signal),
    structuralSharing: (previous, next) =>
      latestCart(previous as Cart | undefined, next as Cart),
    enabled: session.isSuccess,
  })
}
export function useToggleFavorite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean }) =>
      marketplaceApi.favorite(nftId, favorite),
    onMutate: async ({ nftId, favorite }) => {
      const userId = client.getQueryData<Session>(marketKeys.session)?.user?.id
      const key = marketKeys.favorites(userId)
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<Favorites>(key)
      if (previous)
        client.setQueryData<Favorites>(key, {
          ...previous,
          nftIds: favorite
            ? [...new Set([...previous.nftIds, nftId])]
            : previous.nftIds.filter((id) => id !== nftId),
        })
      return { previous, key, token: getAccessToken() }
    },
    onError: (_error, _input, context) => {
      if (context?.previous && context.token === getAccessToken())
        client.setQueryData(context.key, context.previous)
    },
    onSuccess: (data, _input, context) => {
      if (context && context.token === getAccessToken())
        client.setQueryData(context.key, data)
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['favorites'] }),
    scope: { id: 'favorites' },
  })
}
export function useAddCartItem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CartItemInput) => marketplaceApi.addCartItem(input),
    onMutate: () => ({ token: getAccessToken() }),
    onSuccess: (cart, _input, context) => {
      if (context?.token !== getAccessToken()) return
      client.setQueryData(marketKeys.cart(cart.ownerId || getGuestId()), cart)
      void client.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => marketplaceApi.login(input),
    onSuccess: async (session) => {
      await client.cancelQueries({ queryKey: marketKeys.session })
      if (session.accessToken) setAccessToken(session.accessToken)
      await clearPrivateCache(client)
      client.setQueryData(marketKeys.session, session)
      await client.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
export function useRegister() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => marketplaceApi.register(input),
    onSuccess: async (session) => {
      await client.cancelQueries({ queryKey: marketKeys.session })
      if (session.accessToken) setAccessToken(session.accessToken)
      await clearPrivateCache(client)
      client.setQueryData(marketKeys.session, session)
      await client.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
export function useSocialLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: SocialLoginInput) => marketplaceApi.socialLogin(input),
    onSuccess: async (session) => {
      await client.cancelQueries({ queryKey: marketKeys.session })
      if (session.accessToken) setAccessToken(session.accessToken)
      await clearPrivateCache(client)
      client.setQueryData(marketKeys.session, session)
      await client.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await marketplaceApi.logout()
      clearAuthIntent()
      clearAccessToken()
      await client.cancelQueries({ queryKey: marketKeys.session })
      await clearPrivateCache(client)
      await client.resetQueries({ queryKey: marketKeys.session })
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

export function useUpdateCartItem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      marketplaceApi.updateCartItem(id, quantity),
    onMutate: () => ({ token: getAccessToken() }),
    onSuccess: (cart, _input, context) => {
      if (context?.token !== getAccessToken()) return
      client.setQueryData(marketKeys.cart(cart.ownerId || getGuestId()), cart)
      void client.invalidateQueries({ queryKey: ['quotes'] })
    },
    scope: { id: 'cart' },
  })
}
export function useRemoveCartItem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => marketplaceApi.removeCartItem(id),
    onMutate: () => ({ token: getAccessToken() }),
    onSuccess: (cart, _input, context) => {
      if (context?.token !== getAccessToken()) return
      client.setQueryData(marketKeys.cart(cart.ownerId || getGuestId()), cart)
      void client.invalidateQueries({ queryKey: ['quotes'] })
    },
    scope: { id: 'cart' },
  })
}
export function useQuote(couponCode?: string, network?: Network) {
  const cart = useCart()
  const owner = cart.data?.ownerId || getGuestId()
  return useQuery({
    queryKey: [
      'quotes',
      owner,
      cart.data?.version,
      couponCode || '',
      network || '',
    ],
    queryFn: ({ signal }) =>
      marketplaceApi.quote(
        {
          ...(couponCode ? { couponCode } : {}),
          ...(network ? { network } : {}),
        },
        signal,
      ),
    enabled: cart.isSuccess && cart.data.items.length > 0,
    staleTime: 0,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  })
}
export function useProfile() {
  const session = useSession()
  return useQuery({
    queryKey: marketKeys.profile(session.data?.user?.id),
    queryFn: ({ signal }) => marketplaceApi.profile(signal),
    enabled: !!session.data?.user,
  })
}
export function useUpdateProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ProfileInput) => marketplaceApi.updateProfile(input),
    onMutate: () => ({ token: getAccessToken() }),
    onSuccess: (user, _input, context) => {
      if (context?.token !== getAccessToken()) return
      client.setQueryData(marketKeys.profile(user.id), user)
      client.setQueryData<Session>(marketKeys.session, (session) =>
        session?.user?.id === user.id ? { ...session, user } : session,
      )
    },
  })
}
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: PasswordInput) => marketplaceApi.updatePassword(input),
  })
}
export function useWallets() {
  const session = useSession()
  return useQuery({
    queryKey: marketKeys.wallets(session.data?.user?.id),
    queryFn: ({ signal }) => marketplaceApi.wallets(signal),
    enabled: !!session.data?.user,
  })
}
export function useAddWallet() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: WalletInput) => marketplaceApi.addWallet(input),
    onMutate: () => ({ token: getAccessToken() }),
    onSuccess: (_wallet, _input, context) => {
      if (context?.token === getAccessToken())
        void client.invalidateQueries({ queryKey: ['wallets'] })
    },
  })
}
export function useUpdateWallet() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: Partial<WalletInput> & { version: number }
    }) => marketplaceApi.updateWallet(id, input),
    onMutate: () => ({ token: getAccessToken() }),
    onSuccess: (_wallet, _input, context) => {
      if (context?.token === getAccessToken())
        void client.invalidateQueries({ queryKey: ['wallets'] })
    },
  })
}
