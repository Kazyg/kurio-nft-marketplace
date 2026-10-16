export function StarRating({ value }: { value: number }) {
  const rating = Math.min(5, Math.max(0, value))
  return (
    <span
      className="star-rating"
      role="img"
      aria-label={`${rating.toLocaleString('pt-BR')} de 5 estrelas`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span className="star-cell" key={index} aria-hidden="true">
          <span className="rating-star">
            <img
              src="/assets/figma/detail-star-empty.svg"
              alt=""
              width={12.5017}
              height={11.8758}
            />
            <span
              className="star-fill"
              style={{
                width: `${Math.min(1, Math.max(0, rating - index)) * 100}%`,
              }}
            >
              <img
                src="/assets/figma/detail-star-filled.svg"
                alt=""
                width={12.5017}
                height={11.8758}
              />
            </span>
          </span>
        </span>
      ))}
    </span>
  )
}
import './star-rating.css'
