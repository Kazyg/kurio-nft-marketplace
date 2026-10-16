import { useId, useState, type FormEvent } from 'react'
import { z } from 'zod'

export function Newsletter() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [invalid, setInvalid] = useState(false)
  const id = useId()
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!z.email().safeParse(email.trim()).success) {
      setInvalid(true)
      setMessage('Informe um e-mail válido.')
      return
    }
    setEmail('')
    setInvalid(false)
    setMessage('O e-mail foi enviado.')
  }
  return (
    <form onSubmit={submit} noValidate className="newsletter-form">
      <label htmlFor={id} className="sr-only">
        E-mail da newsletter
      </label>
      <div className="newsletter">
        <input
          id={id}
          type="email"
          autoComplete="email"
          value={email}
          placeholder="Digite seu e-mail…"
          aria-invalid={invalid}
          aria-describedby={`${id}-feedback`}
          onChange={(event) => {
            setEmail(event.target.value)
            setInvalid(false)
            setMessage('')
          }}
        />
        <button type="submit">Enviar</button>
      </div>
      <p
        id={`${id}-feedback`}
        aria-live="polite"
        className="newsletter-feedback"
      >
        {message}
      </p>
    </form>
  )
}
