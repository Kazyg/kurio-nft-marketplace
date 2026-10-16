import { useParams } from '@tanstack/react-router'
import { NftDetailsPage } from '@/features/nft-details/nft-details-page'

export function NftRoute() {
  const { nftId } = useParams({ from: '/nfts/$nftId' })
  return <NftDetailsPage nftId={nftId} />
}
