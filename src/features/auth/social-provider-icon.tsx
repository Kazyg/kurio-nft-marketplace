export function SocialProviderIcon({
  provider,
}: {
  provider: 'google' | 'facebook'
}) {
  if (provider === 'facebook')
    return (
      <img
        className="auth-provider-icon"
        src="/assets/figma/auth-facebook.svg"
        alt=""
      />
    )
  return (
    <span className="auth-provider-icon auth-google-icon" aria-hidden="true">
      {[
        'green',
        'green-right',
        'yellow',
        'blue',
        'blue-right',
        'red',
        'red-right',
      ].map((layer) => (
        <img
          key={layer}
          className={`auth-google-${layer}`}
          src={`/assets/figma/auth-google-${layer}.svg`}
          alt=""
        />
      ))}
    </span>
  )
}
