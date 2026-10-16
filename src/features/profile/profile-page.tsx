import { useState } from 'react'
import {
  useForm,
  type UseFormRegister,
  type FieldErrors,
} from 'react-hook-form'
import { z } from 'zod'
import { Eye } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import {
  useChangePassword,
  useProfile,
  useUpdateProfile,
  useWallets,
  useUpdateWallet,
} from '@/shared/api/marketplace-hooks'
import { apiErrorMessage } from '@/shared/api/marketplace'
import type { User } from '@/shared/contracts/marketplace'
import { Button } from '@/shared/ui/button'
import { NetworkError } from '@/shared/ui/network-feedback'
import './profile.css'

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe pelo menos 2 caracteres.').max(80),
  username: z
    .string()
    .regex(
      /^[a-z0-9_]{3,30}$/,
      'Use 3 a 30 letras minúsculas, números ou sublinhado.',
    ),
  email: z.email('Informe um e-mail válido.'),
  ens: z
    .string()
    .refine(
      (value) => !value || /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.eth$/.test(value),
      'Informe um nome .eth válido.',
    ),
  bio: z.string().max(500, 'Use até 500 caracteres.'),
})
type ProfileValues = z.infer<typeof profileSchema>
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z.string().min(8, 'Use pelo menos 8 caracteres.').max(128),
    confirmation: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmation, {
    path: ['confirmation'],
    message: 'As senhas não coincidem.',
  })
type PasswordValues = z.infer<typeof passwordSchema>

function PasswordFields({
  register,
  errors,
}: {
  register: UseFormRegister<ProfileValues & PasswordValues>
  errors: FieldErrors<ProfileValues & PasswordValues>
}) {
  const [visibleFields, setVisibleFields] = useState<
    Partial<Record<keyof PasswordValues, boolean>>
  >({})
  return (
    <section className="account-panel profile-password">
      <h2>Alterar senha</h2>
      <div className="profile-password-fields">
        {(
          [
            ['currentPassword', 'Senha atual', 'current-password'],
            ['newPassword', 'Nova senha', 'new-password'],
            ['confirmation', 'Confirmar nova senha', 'new-password'],
          ] as const
        ).map(([name, label, autoComplete]) => (
          <label key={name}>
            {label}
            <span className="profile-password-input">
              <input
                type={visibleFields[name] ? 'text' : 'password'}
                form="profile-form"
                autoComplete={autoComplete}
                {...register(name)}
                aria-label={label}
                aria-invalid={!!errors[name]}
                aria-describedby={
                  errors[name] ? `password-${name}-error` : undefined
                }
              />
              <button
                className="profile-password-toggle"
                type="button"
                aria-label={`${visibleFields[name] ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
                aria-pressed={!!visibleFields[name]}
                onClick={() =>
                  setVisibleFields((fields) => ({
                    ...fields,
                    [name]: !fields[name],
                  }))
                }
              >
                {visibleFields[name] ? (
                  <Eye size={20} />
                ) : (
                  <img src="/assets/figma/account-hide.svg" alt="" />
                )}
              </button>
            </span>
            {errors[name] && (
              <span id={`password-${name}-error`} role="alert">
                {errors[name].message}
              </span>
            )}
          </label>
        ))}
      </div>
    </section>
  )
}

function ProfileForm({ user }: { user: User }) {
  const query = useProfile()
  const mutation = useUpdateProfile()
  const passwordMutation = useChangePassword()
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const wallets = useWallets()
  const updateWallet = useUpdateWallet()
  const primary =
    wallets.data?.find((wallet) => wallet.isDefault) || wallets.data?.[0]
  const [nickname, setNickname] = useState<string | null>(null)
  const [version, setVersion] = useState(user.version)
  const [avatar, setAvatar] = useState(user.avatar)
  const [avatarError, setAvatarError] = useState('')
  const [success, setSuccess] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues & PasswordValues>({
    defaultValues: {
      name: user.name,
      username: user.username,
      email: user.email,
      ens: user.ens || '',
      bio: user.bio,
      currentPassword: '',
      newPassword: '',
      confirmation: '',
    },
  })
  const submit = handleSubmit(async (values) => {
    setSuccess(false)
    setPasswordSuccess(false)
    passwordMutation.reset()
    const changingPassword = !!(
      values.currentPassword ||
      values.newPassword ||
      values.confirmation
    )
    if (changingPassword) {
      const password = passwordSchema.safeParse(values)
      if (!password.success) {
        password.error.issues.forEach((issue) =>
          setError(issue.path[0] as keyof PasswordValues, {
            message: issue.message,
          }),
        )
        return
      }
    }
    const result = profileSchema.safeParse(values)
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        setError(issue.path[0] as keyof ProfileValues, {
          message: issue.message,
        }),
      )
      return
    }
    try {
      const updated = await mutation.mutateAsync({
        ...result.data,
        bio: query.data?.bio ?? user.bio,
        ens: result.data.ens || null,
        avatar,
        version,
      })
      setVersion(updated.version)
      setAvatar(updated.avatar)
      reset({
        name: updated.name,
        username: updated.username,
        email: updated.email,
        ens: updated.ens || '',
        bio: updated.bio,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmation: values.confirmation,
      })
      if (primary && nickname !== null && nickname !== primary.label) {
        await updateWallet.mutateAsync({
          id: primary.id,
          input: { label: nickname, version: primary.version },
        })
        setNickname(null)
      }
      setSuccess(true)
      if (changingPassword) {
        await passwordMutation.mutateAsync({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        })
        reset({
          name: updated.name,
          username: updated.username,
          email: updated.email,
          ens: updated.ens || '',
          bio: updated.bio,
          currentPassword: '',
          newPassword: '',
          confirmation: '',
        })
        setPasswordSuccess(true)
      }
    } catch {
      return
    }
  })
  async function reloadVersion() {
    setRefreshing(true)
    const result = await query.refetch()
    if (result.isSuccess) {
      setVersion(result.data.version)
      mutation.reset()
    }
    setRefreshing(false)
  }
  return (
    <section className="account-panel profile-panel">
      <h1>Perfil do colecionador</h1>
      <form id="profile-form" noValidate onSubmit={submit}>
        <div className="account-fields">
          {(
            [
              ['name', 'Nome de exibição'],
              ['username', 'Nome de usuário'],
              ['email', 'E-mail'],
              ['ens', 'Nome ENS'],
            ] as const
          ).map(([name, label]) => (
            <label key={name}>
              <span>
                {label}
                {name !== 'ens' && <b aria-hidden="true">*</b>}
              </span>
              <div className={name === 'ens' ? 'account-ens' : undefined}>
                {name === 'ens' && (
                  <span aria-hidden="true">
                    .eth
                    <img src="/assets/figma/account-arrow.svg" alt="" />
                  </span>
                )}
                <input
                  type={name === 'email' ? 'email' : 'text'}
                  {...register(name)}
                  aria-label={name === 'ens' ? 'ENS (opcional)' : label}
                  aria-invalid={!!errors[name]}
                  aria-describedby={
                    errors[name] ? `profile-${name}-error` : undefined
                  }
                  autoComplete={
                    name === 'name'
                      ? 'name'
                      : name === 'email'
                        ? 'email'
                        : name === 'username'
                          ? 'username'
                          : 'off'
                  }
                />
              </div>
              {errors[name] && (
                <span id={`profile-${name}-error`} role="alert">
                  {errors[name].message}
                </span>
              )}
            </label>
          ))}
          <label>
            <span>Apelido da carteira</span>
            <input
              aria-label="Apelido da carteira"
              value={nickname ?? primary?.label ?? ''}
              disabled={!primary || updateWallet.isPending}
              onChange={(event) => setNickname(event.target.value)}
              minLength={2}
              maxLength={80}
            />
            {!primary && (
              <small>
                Cadastre uma carteira em <Link to="/wallets">Carteiras</Link>.
              </small>
            )}
          </label>
          <div className="profile-avatar-field">
            <span>Avatar</span>
            <div className="account-avatar-row">
              {avatar ? (
                <img
                  className="account-avatar"
                  src={avatar}
                  alt="Avatar do perfil"
                />
              ) : (
                <div
                  className="account-avatar"
                  role="img"
                  aria-label="Sem avatar"
                >
                  <img src="/assets/figma/account-image.svg" alt="" />
                </div>
              )}
              <div>
                <label className="account-upload">
                  Alterar
                  <input
                    type="file"
                    aria-label="Escolher avatar"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      setAvatarError('')
                      if (!file) return
                      if (
                        !['image/png', 'image/jpeg', 'image/webp'].includes(
                          file.type,
                        ) ||
                        file.size > 1024 * 1024
                      ) {
                        setAvatarError('Escolha PNG, JPEG ou WebP de até 1 MB.')
                        return
                      }
                      const reader = new FileReader()
                      reader.onload = () => setAvatar(String(reader.result))
                      reader.onerror = () =>
                        setAvatarError('Não foi possível ler a imagem.')
                      reader.readAsDataURL(file)
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="account-text-button"
                  aria-label="Remover avatar"
                  disabled={!avatar}
                  onClick={() => setAvatar(null)}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
        {avatarError && <p role="alert">{avatarError}</p>}

        {mutation.isError && (
          <div role="alert">
            <p>{apiErrorMessage(mutation.error)}</p>
            <p>
              Se os dados mudaram em outra sessão, carregue a versão atual antes
              de tentar novamente. Seu rascunho será preservado; revise-o antes
              de salvar.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={refreshing}
              onClick={() => void reloadVersion()}
            >
              Carregar versão atual
            </Button>
          </div>
        )}
        {success && <p role="status">Perfil atualizado com sucesso.</p>}
        {updateWallet.isError && (
          <p role="alert">
            Perfil salvo, mas o apelido da carteira não foi atualizado:{' '}
            {apiErrorMessage(updateWallet.error)}
          </p>
        )}
      </form>
      <PasswordFields register={register} errors={errors} />
      {passwordMutation.isError && (
        <p role="alert">{apiErrorMessage(passwordMutation.error)}</p>
      )}
      {passwordSuccess && <p role="status">Senha alterada com sucesso.</p>}
      <Button
        form="profile-form"
        aria-label="Salvar perfil"
        disabled={
          passwordMutation.isPending ||
          mutation.isPending ||
          updateWallet.isPending ||
          isSubmitting ||
          !!avatarError
        }
      >
        {mutation.isPending || updateWallet.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </section>
  )
}

export function ProfilePage() {
  const profile = useProfile()
  return (
    <>
      {profile.isPending ? (
        <div
          className="account-panel account-loading shimmer"
          role="status"
          aria-busy="true"
        >
          Carregando perfil…
        </div>
      ) : !profile.data ? (
        <NetworkError
          title="Não foi possível carregar o perfil"
          error={profile.error}
          retry={() => void profile.refetch()}
        />
      ) : (
        <ProfileForm key={profile.data.id} user={profile.data} />
      )}
    </>
  )
}
