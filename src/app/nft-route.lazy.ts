import { createLazyRoute } from '@tanstack/react-router'
import { NftRoute } from './nft-route'

export const Route = createLazyRoute('/nfts/$nftId')({ component: NftRoute })
