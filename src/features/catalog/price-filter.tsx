import { useId, useState, type FormEvent } from 'react'
import * as Slider from '@radix-ui/react-slider'
import type { CatalogSearch } from '@/shared/contracts/marketplace'
import { ethSchema } from '@/shared/contracts/marketplace'
import { toWei, fromWei } from '@/shared/contracts/money'
import { Button } from '@/shared/ui/button'

const ticks = 10000n
function clamp(value: string, ceiling: bigint) {
  if (!value || !ethSchema.safeParse(value).success) return value
  return fromWei(toWei(value) > ceiling ? ceiling : toWei(value))
}
export function PriceFilter({
  search,
  ceiling,
  change,
  reset,
}: {
  search: CatalogSearch
  ceiling: string
  change: (next: Partial<CatalogSearch>) => void
  reset: number
}) {
  const id = useId()
  const source = `${reset}:${search.minPrice || ''}:${search.maxPrice || ''}`
  const [draft, setDraft] = useState({
    min: clamp(search.minPrice || '', toWei(ceiling)),
    max: clamp(search.maxPrice || '', toWei(ceiling)),
    source,
    ceiling,
  })
  const [error, setError] = useState('')
  const limit = toWei(ceiling)
  if (draft.source !== source || draft.ceiling !== ceiling) {
    const min = clamp(
      draft.source !== source ? search.minPrice || '' : draft.min,
      limit,
    )
    const previousMax =
      draft.source !== source ? search.maxPrice || '' : draft.max
    const max =
      previousMax === draft.ceiling && draft.source === source
        ? ceiling
        : clamp(previousMax, limit)
    setDraft({ min, max, source, ceiling })
    if (error) setError('')
  }
  const low = ethSchema.safeParse(draft.min || '0').success
    ? toWei(draft.min || '0')
    : 0n
  const high = ethSchema.safeParse(draft.max || ceiling).success
    ? toWei(draft.max || ceiling)
    : limit
  const boundedLow = low > limit ? limit : low
  const boundedHigh =
    high > limit ? limit : high < boundedLow ? boundedLow : high
  const values = limit
    ? [
        Number((boundedLow * ticks) / limit),
        Number((boundedHigh * ticks) / limit),
      ]
    : [0, 0]
  function apply(event: FormEvent) {
    event.preventDefault()
    if (
      !ethSchema.safeParse(draft.min || '0').success ||
      !ethSchema.safeParse(draft.max || ceiling).success
    ) {
      setError('Use valores ETH válidos com até 18 casas decimais.')
      return
    }
    const min = clamp(draft.min, limit),
      max = clamp(draft.max, limit)
    if (toWei(min || '0') > toWei(max || ceiling)) {
      setError('O preço mínimo não pode ultrapassar o máximo.')
      return
    }
    setError('')
    setDraft({ min, max, source, ceiling })
    change({ minPrice: min || undefined, maxPrice: max || undefined, page: 1 })
  }
  return (
    <form onSubmit={apply} noValidate>
      <Slider.Root
        className="price-slider"
        min={0}
        max={Number(ticks)}
        step={1}
        minStepsBetweenThumbs={0}
        value={values}
        disabled={limit === 0n}
        onValueChange={(next) => {
          setError('')
          setDraft({
            ...draft,
            min: fromWei((limit * BigInt(next[0]!)) / ticks),
            max: fromWei((limit * BigInt(next[1]!)) / ticks),
          })
        }}
      >
        <Slider.Track className="price-slider-track">
          <Slider.Range className="price-slider-range" />
        </Slider.Track>
        <Slider.Thumb
          className="price-slider-thumb"
          aria-label="Preço mínimo no slider"
          aria-valuetext={`${fromWei(boundedLow)} ETH`}
        />
        <Slider.Thumb
          className="price-slider-thumb"
          aria-label="Preço máximo no slider"
          aria-valuetext={`${fromWei(boundedHigh)} ETH`}
        />
      </Slider.Root>
      <div className="price-inputs">
        <label htmlFor={`${id}-min`}>
          Mínimo
          <input
            id={`${id}-min`}
            aria-label="Preço mínimo em ETH"
            inputMode="decimal"
            placeholder="0"
            value={draft.min}
            onChange={(event) =>
              setDraft({ ...draft, min: event.target.value })
            }
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </label>
        <label htmlFor={`${id}-max`}>
          Máximo
          <input
            id={`${id}-max`}
            aria-label="Preço máximo em ETH"
            inputMode="decimal"
            placeholder={ceiling}
            value={draft.max}
            onChange={(event) =>
              setDraft({ ...draft, max: event.target.value })
            }
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </label>
      </div>
      <p data-testid="price-range-limit">De 0 até {ceiling} ETH</p>
      {error && (
        <p role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
      <Button>Aplicar</Button>
    </form>
  )
}
