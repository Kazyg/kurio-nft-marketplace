import { useState } from 'react'
import { Copy } from 'lucide-react'

export function ShareNft({ name }: { name: string }) {
  const [message, setMessage] = useState('')
  const url = window.location.href
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setMessage('Link copiado.')
    } catch {
      setMessage('Não foi possível copiar. Use o endereço desta página.')
    }
  }
  return (
    <section className="nft-share" aria-label="Compartilhar este NFT">
      <span>Compartilhar este NFT:</span>
      <div>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label="Copiar link deste NFT"
        >
          <Copy size={18} />
        </button>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Compartilhar NFT no X"
        >
          <img
            src="/assets/figma/imgFrame110.svg"
            alt=""
            width={30}
            height={30}
          />
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Compartilhar NFT no LinkedIn"
        >
          <img
            src="/assets/figma/imgFrame111.svg"
            alt=""
            width={30}
            height={30}
          />
        </a>
      </div>
      <p aria-live="polite">{message}</p>
    </section>
  )
}
