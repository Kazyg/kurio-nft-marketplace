import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Eye } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import {
  useLogin,
  useRegister,
  useSocialLogin,
} from '@/shared/api/marketplace-hooks'
import { Button } from '@/shared/ui/button'
import { AuthModal } from './auth-modal'
import { SocialProviderIcon } from './social-provider-icon'
import { safeReturnTo } from '@/shared/lib/redirect'
import { clearAuthIntent } from '@/shared/lib/auth-intent'
import './auth.css'
import { useAuthDialog } from './use-auth-dialog'

type Mode = 'login' | 'register'
type Fields = {
  name: string
  email: string
  password: string
  confirmation: string
}
const emailSchema = z.email('Informe um e-mail válido.').max(254)

export function AuthForm({
  mode,
  onSuccess,
  onModeChange,
}: {
  mode: Mode
  onSuccess?: () => void
  onModeChange?: (mode: Mode) => void
}) {
  const id = useId()
  const login = useLogin()
  const signup = useRegister()
  const social = useSocialLogin()
  const desktop = useAuthDialog()
  const tabs = useRef<HTMLDivElement>(null)
  const focusTab = useRef(false)
  const [visible, setVisible] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const submitting = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    defaultValues: { name: '', email: '', password: '', confirmation: '' },
  })
  const busy =
    isSubmitting || login.isPending || signup.isPending || social.isPending
  const creating = mode === 'register'
  useEffect(() => {
    reset()
    if (focusTab.current) {
      tabs.current
        ?.querySelector<HTMLElement>('[aria-selected="true"]')
        ?.focus()
      focusTab.current = false
    }
  }, [mode, reset])
  async function socialLogin(provider: 'google' | 'facebook') {
    if (busy || submitting.current) return
    submitting.current = true
    clearErrors('root')
    try {
      await social.mutateAsync({ provider })
      reset()
      setVisible(false)
      onSuccess?.()
    } catch {
      setError('root', {
        message: 'Não foi possível entrar. Tente novamente.',
      })
    } finally {
      submitting.current = false
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(async (values) => {
      if (busy || submitting.current) return
      submitting.current = true
      try {
        if (creating)
          await signup.mutateAsync({
            name: values.name.trim(),
            email: values.email.trim(),
            password: values.password,
          })
        else
          await login.mutateAsync({
            email: values.email.trim(),
            password: values.password,
          })
        reset()
        setVisible(false)
        onSuccess?.()
      } catch (error) {
        const status = isAxiosError(error) ? error.response?.status : undefined
        if (creating && status === 409)
          setError(
            'email',
            { message: 'Este e-mail já está cadastrado.' },
            { shouldFocus: true },
          )
        else
          setError('root', {
            message:
              status === 401
                ? 'E-mail ou senha incorretos.'
                : 'Não foi possível continuar. Tente novamente.',
          })
      } finally {
        submitting.current = false
      }
    })(event)
  }
  const fieldError = (field: keyof Fields) =>
    errors[field] && (
      <span id={`${id}-${field}-error`} className="auth-error" role="alert">
        {errors[field]?.message}
      </span>
    )
  function changeMode(next: Mode = creating ? 'login' : 'register') {
    if (busy || next === mode) return
    reset()
    social.reset()
    setVisible(false)
    setRecovery(false)
    onModeChange?.(next)
  }
  return (
    <div className={`auth-form-wrap auth-mode-${mode}`}>
      <div
        className="auth-tabs"
        ref={tabs}
        role="tablist"
        aria-label="Autenticação"
      >
        {(['login', 'register'] as const).map((next) => (
          <button
            type="button"
            role="tab"
            id={`${id}-${next}-tab`}
            key={next}
            aria-selected={mode === next}
            aria-controls={`${id}-form`}
            tabIndex={mode === next ? 0 : -1}
            disabled={busy}
            onClick={() => changeMode(next)}
            onKeyDown={(event) => {
              if (
                ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
              ) {
                event.preventDefault()
                const target =
                  event.key === 'Home'
                    ? 'login'
                    : event.key === 'End'
                      ? 'register'
                      : next === 'login'
                        ? 'register'
                        : 'login'
                if (target !== mode) {
                  focusTab.current = true
                  changeMode(target)
                }
              }
            }}
          >
            {next === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>
      <p className="auth-intro">
        {creating
          ? 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'
          : 'Entre para gerenciar sua carteira, coleção e perfil de criador.'}
      </p>
      <form
        id={`${id}-form`}
        role="tabpanel"
        aria-labelledby={`${id}-${mode}-tab`}
        className="auth-form"
        onSubmit={submit}
        noValidate
      >
        {creating && (
          <div className="auth-field">
            <label htmlFor={`${id}-name`}>Nome de usuário</label>
            <input
              id={`${id}-name`}
              autoComplete="nickname"
              placeholder="Nome de usuário"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? `${id}-name-error` : undefined}
              {...register('name', {
                validate: (value) =>
                  z.string().trim().min(2).max(80).safeParse(value).success ||
                  'Use de 2 a 80 caracteres.',
              })}
            />
            {fieldError('name')}
          </div>
        )}
        <div className="auth-field">
          <label htmlFor={`${id}-email`}>E-mail</label>
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder={creating ? 'Digite seu e-mail' : 'contato@email.com'}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? `${id}-email-error` : undefined}
            {...register('email', {
              validate: (value) =>
                emailSchema.safeParse(value.trim()).success ||
                'Informe um e-mail válido.',
            })}
          />
          {fieldError('email')}
        </div>
        <div className="auth-field">
          <label htmlFor={`${id}-password`}>Senha</label>
          <div className="auth-password">
            <input
              id={`${id}-password`}
              type={visible ? 'text' : 'password'}
              autoComplete={creating ? 'new-password' : 'current-password'}
              placeholder="Senha"
              aria-invalid={!!errors.password}
              aria-describedby={
                errors.password
                  ? `${id}-password-error`
                  : creating
                    ? `${id}-password-hint`
                    : undefined
              }
              {...register('password', {
                validate: (value) =>
                  z
                    .string()
                    .min(creating ? 8 : 1)
                    .max(128)
                    .safeParse(value).success ||
                  (creating
                    ? 'Use de 8 a 128 caracteres.'
                    : 'Informe sua senha.'),
              })}
            />
            <button
              type="button"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={visible}
            >
              {visible ? (
                <Eye size={19} />
              ) : (
                <picture>
                  <source
                    media="(max-width: 767px)"
                    srcSet="/assets/figma/auth-hide-mobile.svg"
                  />
                  <img src="/assets/figma/auth-hide.svg" alt="" />
                </picture>
              )}
            </button>
          </div>
          {creating && (
            <small id={`${id}-password-hint`} className="sr-only">
              Use pelo menos 8 caracteres.
            </small>
          )}
          {fieldError('password')}
        </div>
        {creating && (
          <div className="auth-field">
            <label htmlFor={`${id}-confirmation`}>Confirmar senha</label>
            <div className="auth-password">
              <input
                id={`${id}-confirmation`}
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Confirmar senha"
                aria-invalid={!!errors.confirmation}
                aria-describedby={
                  errors.confirmation ? `${id}-confirmation-error` : undefined
                }
                {...register('confirmation', {
                  validate: (value, values) =>
                    value === values.password || 'As senhas não coincidem.',
                })}
              />
              <button
                className="auth-confirm-toggle"
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={
                  visible
                    ? 'Ocultar confirmação de senha'
                    : 'Mostrar confirmação de senha'
                }
                aria-pressed={visible}
              >
                {visible ? (
                  <Eye size={19} />
                ) : (
                  <img src="/assets/figma/auth-hide-mobile.svg" alt="" />
                )}
              </button>
            </div>
            {fieldError('confirmation')}
          </div>
        )}
        {!creating && (
          <div className="auth-forgot">
            <button
              type="button"
              onClick={() => setRecovery(!recovery)}
              aria-expanded={recovery}
            >
              Esqueceu a senha?
            </button>
            {recovery && (
              <p role="status">
                Recuperação de senha indisponível. Use sua senha de cadastro ou
                entre com uma conta social.
              </p>
            )}
          </div>
        )}
        {errors.root && (
          <p role="alert" className="auth-error">
            {errors.root.message}
          </p>
        )}
        <Button
          className="auth-submit"
          type="submit"
          disabled={busy}
          aria-busy={busy}
        >
          {busy
            ? creating
              ? 'Criando conta…'
              : 'Entrando…'
            : creating
              ? desktop
                ? 'Criar conta'
                : 'Criar perfil'
              : 'Entrar'}
        </Button>
      </form>
      <div className="auth-social">
        <div className="auth-divider">
          <span>Ou continue com</span>
        </div>
        <div className="auth-social-buttons">
          {(['google', 'facebook'] as const).map((provider) => (
            <Button
              key={provider}
              variant="outline"
              type="button"
              disabled={busy}
              aria-label={`Continuar com ${provider === 'google' ? 'Google' : 'Facebook'}`}
              aria-busy={
                social.isPending && social.variables?.provider === provider
              }
              onClick={() => void socialLogin(provider)}
            >
              <SocialProviderIcon provider={provider} />
              <span>
                {social.isPending && social.variables?.provider === provider
                  ? 'Entrando…'
                  : `Continuar com ${provider === 'google' ? 'Google' : 'Facebook'}`}
              </span>
            </Button>
          ))}
        </div>
      </div>
      {onModeChange && (
        <p className="auth-switch">
          {creating ? 'Já tem uma conta?' : 'Novo na Kurio?'}{' '}
          <button type="button" onClick={() => changeMode()} disabled={busy}>
            {creating ? 'Entre' : 'Crie uma conta'}
          </button>
        </p>
      )}
    </div>
  )
}

export function AuthPage({
  mode,
  redirectTo,
}: {
  mode: Mode
  redirectTo?: string
}) {
  const navigate = useNavigate()
  const desktop = useAuthDialog()
  const title = mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'
  const destination = safeReturnTo(redirectTo)
  const cancelDestination =
    /^\/(profile|wallets|favorites|orders|checkout)(?:[/?#]|$)/.test(
      destination,
    )
      ? '/'
      : destination
  const leave = () => void navigate({ to: destination, replace: true })
  const form = (
    <AuthForm
      mode={mode}
      onSuccess={leave}
      onModeChange={(next) =>
        void navigate({
          to: next === 'login' ? '/login' : '/register',
          search: { redirect: safeReturnTo(redirectTo) },
        })
      }
    />
  )
  if (desktop)
    return (
      <AuthModal
        open
        mode={mode}
        onOpenChange={(open) => {
          if (!open) {
            clearAuthIntent()
            void navigate({ to: cancelDestination, replace: true })
          }
        }}
      >
        {form}
      </AuthModal>
    )
  return (
    <section className="auth-page">
      <Link
        to={cancelDestination}
        replace
        className="auth-back"
        onClick={clearAuthIntent}
      >
        ← Voltar
      </Link>
      <div className="auth-brand" aria-label="Kurio">
        KURIO
      </div>
      <h1>{title}</h1>
      {form}
    </section>
  )
}
