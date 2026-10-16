import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useId } from 'react'
import { z } from 'zod'
import {
  useAddWallet,
  useUpdateWallet,
  useWallets,
  useProfile,
} from '@/shared/api/marketplace-hooks'
import { apiErrorMessage } from '@/shared/api/marketplace'
import type { Wallet, WalletInput, User } from '@/shared/contracts/marketplace'
import { Button } from '@/shared/ui/button'
import { NetworkError } from '@/shared/ui/network-feedback'
import './wallets.css'

const networks = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
} as const
const providers = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
} as const
const walletSchema = z
  .object({
    label: z.string().trim().min(2, 'Informe pelo menos 2 caracteres.').max(80),
    address: z.string().trim(),
    network: z.enum(['ethereum', 'polygon', 'solana']),
    provider: z.enum(['metamask', 'walletconnect', 'coinbase']),
    displayName: z.string().trim().max(100),
    profileName: z.string().trim().max(100),
    secondaryAddress: z.string().trim().max(100),
    referralCode: z.string().trim().max(100),
    email: z.union([z.email('Informe um e-mail válido.'), z.literal('')]),
    ens: z
      .string()
      .refine(
        (value) =>
          !value || /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.eth$/.test(value),
        'Informe um nome .eth válido.',
      ),
  })
  .superRefine((value, context) => {
    const valid =
      value.network === 'solana'
        ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.address)
        : /^0x[0-9a-fA-F]{40}$/.test(value.address)
    if (!valid)
      context.addIssue({
        code: 'custom',
        path: ['address'],
        message:
          value.network === 'solana'
            ? 'Informe um endereço Solana base58 com 32 a 44 caracteres.'
            : 'Informe 0x seguido de 40 caracteres hexadecimais.',
      })
  })
type WalletValues = z.infer<typeof walletSchema>

function WalletForm({
  wallet,
  first,
  user,
  close,
  active = true,
}: {
  wallet?: Wallet
  first: boolean
  user?: User
  close: (saved?: boolean) => void
  active?: boolean
}) {
  const id = useId()
  const add = useAddWallet(),
    update = useUpdateWallet(),
    query = useWallets()
  const [version, setVersion] = useState(wallet?.version)
  const [reloading, setReloading] = useState(false)
  const [reloadMessage, setReloadMessage] = useState('')
  const mutation = wallet ? update : add
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WalletValues>({
    defaultValues: {
      label: wallet?.label || '',
      address: wallet?.address || '',
      network: wallet?.network || 'ethereum',
      provider: wallet?.provider || 'metamask',
      displayName: wallet?.displayName ?? user?.name ?? '',
      profileName: wallet?.profileName ?? user?.username ?? '',
      secondaryAddress: wallet?.secondaryAddress ?? '',
      referralCode: wallet?.referralCode ?? '',
      email: wallet?.email ?? user?.email ?? '',
      ens: wallet?.ens ?? user?.ens ?? '',
    },
  })
  const submit = handleSubmit(async (values) => {
    const result = walletSchema.safeParse(values)
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        setError(issue.path[0] as keyof WalletValues, {
          message: issue.message,
        }),
      )
      return
    }
    try {
      if (wallet) {
        const saved = await update.mutateAsync({
          id: wallet.id,
          input: { ...result.data, version: version! },
        })
        setVersion(saved.version)
      } else
        await add.mutateAsync({
          ...result.data,
          isDefault: first,
        } satisfies WalletInput)
      close(true)
    } catch {
      return
    }
  })
  async function reload() {
    setReloading(true)
    const result = await query.refetch()
    const current = result.data?.find((item) => item.id === wallet?.id)
    if (result.isSuccess && current) {
      setVersion(current.version)
      update.reset()
      setReloadMessage(
        'Versão atual carregada. Seu rascunho foi preservado; revise antes de salvar.',
      )
    }
    setReloading(false)
  }
  function field(
    name: keyof WalletValues,
    label: string,
    ariaLabel = label,
    placeholder?: string,
  ) {
    return (
      <label>
        <span>
          {label}
          {['label', 'address'].includes(name) && <b aria-hidden="true">*</b>}
        </span>
        <input
          {...register(name)}
          aria-label={ariaLabel}
          placeholder={placeholder}
          type={name === 'email' ? 'email' : 'text'}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
        />
        {errors[name] && (
          <span id={`${id}-${name}-error`} role="alert">
            {errors[name].message}
          </span>
        )}
      </label>
    )
  }
  return (
    <form
      className="wallet-form"
      data-active={active}
      noValidate
      onSubmit={submit}
    >
      <div className="wallet-fields">
        {field('displayName', 'Nome de exibição')}
        {field('label', 'Apelido da carteira', 'Nome da carteira')}
        <label>
          <span>
            Rede<b aria-hidden="true">*</b>
          </span>
          <select {...register('network')} aria-label="Rede">
            {Object.entries(networks).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {field('profileName', 'Nome do perfil')}
        {field(
          'address',
          'Endereço da carteira',
          'Endereço público',
          'Endereço 0x ou Solana da carteira',
        )}
        {field('secondaryAddress', 'ENS ou carteira secundária (opcional)')}
        <label>
          <span>
            Tipo de carteira<b aria-hidden="true">*</b>
          </span>
          <select {...register('provider')} aria-label="Provedor">
            {Object.entries(providers).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {field('referralCode', 'Código de indicação')}
        {field('email', 'E-mail')}
        <label>
          <span>Nome ENS</span>
          <div className="wallet-ens">
            <span aria-hidden="true">
              .eth
              <img src="/assets/figma/account-arrow.svg" alt="" />
            </span>
            <input
              {...register('ens')}
              aria-label="Nome ENS"
              aria-invalid={!!errors.ens}
              aria-describedby={errors.ens ? `${id}-ens-error` : undefined}
            />
          </div>
          {errors.ens && (
            <span id={`${id}-ens-error`} role="alert">
              {errors.ens.message}
            </span>
          )}
        </label>
      </div>
      {mutation.isError && (
        <div role="alert">
          <p>{apiErrorMessage(mutation.error)}</p>
          {wallet && (
            <>
              <p>
                Seu rascunho está preservado. Carregue a versão atual antes de
                salvar novamente.
              </p>
              <Button
                variant="outline"
                type="button"
                onClick={() => void reload()}
                disabled={reloading}
              >
                Carregar versão atual
              </Button>
            </>
          )}
        </div>
      )}
      {reloadMessage && <p role="status">{reloadMessage}</p>}
      <div className="wallet-actions">
        <Button disabled={mutation.isPending || isSubmitting}>
          {mutation.isPending ? 'Salvando…' : 'Salvar carteira'}
        </Button>
      </div>
    </form>
  )
}

export function WalletsPage() {
  const query = useWallets(),
    profile = useProfile(),
    update = useUpdateWallet()
  const [editing, setEditing] = useState<Wallet | 'new' | null>(null)
  const [notice, setNotice] = useState('')
  const [sameAsMain, setSameAsMain] = useState(false)
  const wallets = query.data ?? []
  const main = wallets.find((wallet) => wallet.isDefault) || wallets[0]
  const secondary = wallets.filter((wallet) => wallet.id !== main?.id)
  function close(saved?: boolean) {
    setEditing(null)
    setNotice(saved ? 'Carteira salva com sucesso.' : '')
  }
  async function setDefault(wallet: Wallet) {
    setNotice('')
    try {
      await update.mutateAsync({
        id: wallet.id,
        input: { isDefault: true, version: wallet.version },
      })
      setNotice('Carteira principal atualizada.')
    } catch {
      return
    }
  }
  return (
    <>
      {query.isPending ? (
        <div role="status" aria-busy="true" className="wallet-loading shimmer">
          Carregando carteiras…
        </div>
      ) : !query.data ? (
        <NetworkError
          title="Não foi possível carregar as carteiras"
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <header className="wallet-heading">
            <div>
              <h1>Carteira principal</h1>
              <button
                type="button"
                aria-label="Adicionar carteira"
                onClick={() => {
                  setEditing('new')
                  setSameAsMain(false)
                  setNotice('')
                }}
              >
                Adicionar
              </button>
            </div>
            <p>
              Estas carteiras ficam disponíveis no pagamento e para receber NFTs
              comprados.
            </p>
          </header>
          {notice && (
            <p className="wallet-notice" role="status">
              {notice}
            </p>
          )}
          {update.isError && (
            <div role="alert">
              <p>{apiErrorMessage(update.error)}</p>
              <Button
                variant="outline"
                onClick={() => {
                  void query.refetch()
                  update.reset()
                }}
              >
                Atualizar carteiras
              </Button>
            </div>
          )}
          <fieldset className="wallet-primary" disabled={!!editing}>
            <WalletForm
              key={main ? `${main.id}-${main.version}` : 'first'}
              wallet={main}
              active={!editing}
              first={!wallets.length}
              user={profile.data}
              close={close}
            />
          </fieldset>
          {editing && editing !== 'new' && (
            <section className="wallet-edit">
              <h2>Editar carteira</h2>
              <WalletForm
                key={editing.id}
                wallet={editing}
                first={false}
                user={profile.data}
                close={close}
              />
            </section>
          )}
          <section className="wallet-secondary">
            <header>
              <h2>Carteira secundária</h2>
              <label>
                <input
                  type="checkbox"
                  checked={sameAsMain}
                  disabled={!main}
                  onChange={(event) => {
                    setSameAsMain(event.target.checked)
                    if (event.target.checked) setEditing(null)
                  }}
                />
                Igual à carteira principal
              </label>
              <button
                type="button"
                onClick={() => {
                  setEditing('new')
                  setSameAsMain(false)
                  setNotice('')
                }}
              >
                Adicionar
              </button>
            </header>
            {sameAsMain ? (
              <p>
                A carteira principal será utilizada. Nenhum cadastro adicional
                foi criado.
              </p>
            ) : editing === 'new' ? (
              <WalletForm
                first={!wallets.length}
                user={profile.data}
                close={close}
              />
            ) : secondary.length === 0 ? (
              <p>Você ainda não adicionou uma carteira secundária.</p>
            ) : null}
          </section>
          <div className="wallet-saved-list">
            {wallets.map((wallet) => (
              <article key={wallet.id}>
                <h3>
                  <strong>{wallet.label}</strong>
                  <span>{wallet.isDefault ? 'Principal' : 'Secundária'}</span>
                </h3>
                <p>
                  {networks[wallet.network]} • {providers[wallet.provider]}
                </p>
                <p className="wallet-address">{wallet.address}</p>
                <div className="wallet-actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(wallet)
                      setNotice('')
                    }}
                    disabled={editing !== null}
                  >
                    Editar {wallet.label}
                  </Button>
                  {!wallet.isDefault && (
                    <Button
                      variant="outline"
                      disabled={update.isPending}
                      onClick={() => void setDefault(wallet)}
                    >
                      Tornar principal {wallet.label}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}
