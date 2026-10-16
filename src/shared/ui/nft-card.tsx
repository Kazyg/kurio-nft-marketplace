import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import type { Nft } from '@/shared/contracts/marketplace'
import { FavoriteButton } from './favorite-button'
import { nftImageProps } from '@/shared/lib/nft-image'

export const NftCard = memo(function NftCard({
  nft,
  compact = false,
  priority = false,
}: {
  nft: Nft
  compact?: boolean
  priority?: boolean
}) {
  return (
    <article className="nft-card" data-testid="catalog-card">
      <Link
        to="/nfts/$nftId"
        params={{ nftId: nft.id }}
        className="nft-art"
        aria-label={`Ver ${nft.name}${!compact && nft.badge ? `, ${nft.badge}` : ''}`}
      >
        <img
          {...nftImageProps(
            nft.image,
            '(min-width: 1024px) 250px, (max-width: 380px) calc((100vw - 64px) / 2), calc((100vw - 80px) / 2)',
          )}
          alt={nft.name}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          width={250}
          height={250}
        />
        {!compact && nft.badge && (
          <span className="nft-badge">{nft.badge}</span>
        )}
      </Link>
      {!compact && <FavoriteButton nft={nft} />}
      <Link className="nft-name" to="/nfts/$nftId" params={{ nftId: nft.id }}>
        {nft.name}
      </Link>
      <p className="nft-price">
        {nft.priceEth} ETH{' '}
        {!compact && nft.previousPriceEth && (
          <del>{nft.previousPriceEth} ETH</del>
        )}
      </p>
    </article>
  )
})
