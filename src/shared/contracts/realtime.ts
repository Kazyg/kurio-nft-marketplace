import type { Nft, Order } from './marketplace'

interface EventIdentity {
  eventId: string
  sequence: number
  version: number
  updatedAt: string
}
export interface NftUpdatedEvent extends EventIdentity {
  type: 'nft.updated'
  nftId: string
  nft: Nft
}
export interface OrderUpdatedEvent extends EventIdentity {
  type: 'order.updated'
  orderId: string
  userId: string
  order: Order
}
export type DomainEvent = NftUpdatedEvent | OrderUpdatedEvent
