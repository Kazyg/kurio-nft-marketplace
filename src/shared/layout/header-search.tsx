import { useCallback, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { catalogSearchSchema } from '@/shared/contracts/marketplace'
import { useDesktop } from '@/shared/lib/use-desktop'

export function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const focusInput = useCallback(
    (input: HTMLInputElement | null) => input?.focus(),
    [],
  )
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const desktop = useDesktop()
  if (!desktop) return null
  return (
    <div className={`header-search ${open ? 'is-expanded' : ''}`}>
      <button
        ref={trigger}
        type="button"
        aria-label="Buscar no catálogo"
        aria-expanded={open}
        aria-controls="desktop-catalog-search"
        onClick={() => setOpen((value) => !value)}
      >
        <img
          src="/assets/figma/imgSearchIcon.svg"
          alt=""
          width={24}
          height={24}
        />
      </button>
      {open && (
        <div className="header-search-field" id="desktop-catalog-search">
          <input
            ref={focusInput}
            aria-label="Buscar NFTs"
            placeholder="Explorar coleções"
            value={search.q || ''}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
                trigger.current?.focus()
              }
            }}
            onChange={(event) =>
              void navigate({
                to: '/',
                search: catalogSearchSchema.parse({
                  ...search,
                  q: event.target.value,
                  page: 1,
                }),
                resetScroll: false,
              })
            }
          />
        </div>
      )}
    </div>
  )
}
