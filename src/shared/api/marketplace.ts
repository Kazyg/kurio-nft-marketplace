import type {
  ApiErrorBody,
  Cart,
  CartItemInput,
  CatalogContent,
  CatalogSearch,
  CreateOrderInput,
  Favorites,
  LoginInput,
  Nft,
  NftList,
  Order,
  PasswordInput,
  ProfileInput,
  Quote,
  QuoteInput,
  RegisterInput,
  Session,
  SocialLoginInput,
  User,
  Wallet,
  WalletInput,
} from '@/shared/contracts/marketplace'
import { endpoints } from '@/shared/contracts/marketplace'
import { isAxiosError } from 'axios'
import { api } from './client'

export const marketplaceApi = {
  list: async (params: CatalogSearch, signal?: AbortSignal) =>
    (await api.get<NftList>(endpoints.nfts, { params, signal })).data,
  nft: async (id: string, signal?: AbortSignal) =>
    (
      await api.get<Nft>(`${endpoints.nfts}/${encodeURIComponent(id)}`, {
        signal,
      })
    ).data,
  content: async (signal?: AbortSignal) =>
    (await api.get<CatalogContent>(endpoints.content, { signal })).data,
  session: async (signal?: AbortSignal) => {
    try {
      return (await api.get<Session>(endpoints.session, { signal })).data
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401)
        return (await api.get<Session>(endpoints.session, { signal })).data
      throw error
    }
  },
  login: async (input: LoginInput) =>
    (await api.post<Session>(endpoints.login, input)).data,
  socialLogin: async (input: SocialLoginInput) =>
    (await api.post<Session>(endpoints.social, input)).data,
  register: async (input: RegisterInput) =>
    (await api.post<Session>(endpoints.register, input)).data,
  logout: async () => {
    await api.post(endpoints.logout)
  },
  favorites: async (signal?: AbortSignal) =>
    (await api.get<Favorites>(endpoints.favorites, { signal })).data,
  favorite: async (nftId: string, favorite: boolean) =>
    (
      await api.request<Favorites>({
        url: `${endpoints.favorites}/${encodeURIComponent(nftId)}`,
        method: favorite ? 'PUT' : 'DELETE',
      })
    ).data,
  cart: async (signal?: AbortSignal) =>
    (await api.get<Cart>(endpoints.cart, { signal })).data,
  addCartItem: async (input: CartItemInput) =>
    (await api.post<Cart>(endpoints.cartItems, input)).data,
  updateCartItem: async (id: string, quantity: number) =>
    (
      await api.patch<Cart>(
        `${endpoints.cartItems}/${encodeURIComponent(id)}`,
        { quantity },
      )
    ).data,
  removeCartItem: async (id: string) =>
    (await api.delete<Cart>(`${endpoints.cartItems}/${encodeURIComponent(id)}`))
      .data,
  quote: async (input: QuoteInput, signal?: AbortSignal) =>
    (await api.post<Quote>(endpoints.quotes, input, { signal })).data,
  order: async (input: CreateOrderInput, idempotencyKey: string) =>
    (
      await api.post<Order>(endpoints.orders, input, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
    ).data,
  orders: async (signal?: AbortSignal) =>
    (await api.get<Order[]>(endpoints.orders, { signal })).data,
  getOrderByAttempt: async (idempotencyKey: string, signal?: AbortSignal) =>
    (
      await api.get<Order[]>(endpoints.orders, {
        params: { idempotencyKey },
        signal,
      })
    ).data[0] ?? null,
  getOrder: async (id: string, signal?: AbortSignal) =>
    (
      await api.get<Order>(`${endpoints.orders}/${encodeURIComponent(id)}`, {
        signal,
      })
    ).data,
  profile: async (signal?: AbortSignal) =>
    (await api.get<User>(endpoints.profile, { signal })).data,
  updateProfile: async (input: ProfileInput) =>
    (await api.patch<User>(endpoints.profile, input)).data,
  updatePassword: async (input: PasswordInput) => {
    await api.put(endpoints.password, input)
  },
  wallets: async (signal?: AbortSignal) =>
    (await api.get<Wallet[]>(endpoints.wallets, { signal })).data,
  addWallet: async (input: WalletInput) =>
    (await api.post<Wallet>(endpoints.wallets, input)).data,
  updateWallet: async (
    id: string,
    input: Partial<WalletInput> & { version: number },
  ) =>
    (
      await api.patch<Wallet>(
        `${endpoints.wallets}/${encodeURIComponent(id)}`,
        input,
      )
    ).data,
}

export function apiErrorMessage(error: unknown) {
  if (isAxiosError<ApiErrorBody>(error))
    return (
      error.response?.data?.error?.message ||
      (error.code === 'ECONNABORTED'
        ? 'A operação demorou mais que o esperado. Tente novamente.'
        : 'Não foi possível comunicar com o serviço.')
    )
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.'
}
