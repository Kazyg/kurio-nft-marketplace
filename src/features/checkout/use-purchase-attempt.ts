import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import { marketplaceApi, apiErrorMessage } from '@/shared/api/marketplace'
import { getAccessToken } from '@/shared/api/identity'
import { ordersKeys, preserveOrder, useOrder } from '@/shared/api/order-hooks'
import type { CreateOrderInput, Order } from '@/shared/contracts/marketplace'

interface Attempt {
  key: string
  payload: CreateOrderInput
  orderId?: string
}
export function requestNewCheckout(userId: string) {
  sessionStorage.setItem(`kurio:new-checkout:${userId}`, 'true')
}

export function usePurchaseAttempt(userId: string) {
  const storageKey = `kurio:purchase:${userId}`
  const [attempt, setAttempt] = useState<Attempt | null>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(storageKey) || 'null',
      ) as Attempt | null
    } catch {
      return null
    }
  })
  const [checkingEntry, setCheckingEntry] = useState(
    () =>
      !!attempt?.orderId &&
      sessionStorage.getItem(`kurio:new-checkout:${userId}`) === 'true',
  )
  const [phase, setPhase] = useState<
    'idle' | 'sending' | 'recovering' | 'unknown' | 'error'
  >('idle')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const client = useQueryClient()
  const order = useOrder(attempt?.orderId || '')
  useEffect(() => {
    sessionStorage.removeItem(`kurio:new-checkout:${userId}`)
  }, [userId])
  useEffect(() => {
    if (!checkingEntry || !attempt?.orderId) return
    let active = true
    const token = getAccessToken()
    void marketplaceApi
      .getOrder(attempt.orderId)
      .then((found) => {
        if (!active || token !== getAccessToken()) return
        if (found.status !== 'pending') {
          localStorage.removeItem(storageKey)
          setAttempt(null)
        }
        setCheckingEntry(false)
      })
      .catch(() => {
        if (active && token === getAccessToken()) setCheckingEntry(false)
      })
    return () => {
      active = false
    }
  }, [attempt, checkingEntry, storageKey])
  function save(value: Attempt | null) {
    if (value) localStorage.setItem(storageKey, JSON.stringify(value))
    else localStorage.removeItem(storageKey)
    setAttempt(value)
  }
  function receive(value: Order, current: Attempt) {
    save({ ...current, orderId: value.id })
    client.setQueryData<Order>(ordersKeys.detail(userId, value.id), (old) =>
      preserveOrder(old, value),
    )
    void client.invalidateQueries({ queryKey: ordersKeys.list(userId) })
    void client.invalidateQueries({ queryKey: ['cart'] })
    setPhase('idle')
  }
  useEffect(() => {
    if (!attempt || attempt.orderId || lock.current) return
    let active = true
    const token = getAccessToken()
    void marketplaceApi
      .getOrderByAttempt(attempt.key)
      .then((found) => {
        if (!active || token !== getAccessToken()) return
        if (found) {
          const next = { ...attempt, orderId: found.id }
          localStorage.setItem(storageKey, JSON.stringify(next))
          setAttempt(next)
          client.setQueryData<Order>(
            ordersKeys.detail(userId, found.id),
            (old) => preserveOrder(old, found),
          )
          void client.invalidateQueries({ queryKey: ordersKeys.list(userId) })
          void client.invalidateQueries({ queryKey: ['cart'] })
          setPhase('idle')
        } else setPhase('unknown')
      })
      .catch(() => {
        if (active && token === getAccessToken()) setPhase('unknown')
      })
    return () => {
      active = false
    }
  }, [attempt, client, storageKey, userId])
  async function send(input?: CreateOrderInput) {
    if (lock.current) return
    const current =
      attempt || (input ? { key: crypto.randomUUID(), payload: input } : null)
    if (!current || current.orderId) return
    lock.current = true
    const token = getAccessToken()
    save(current)
    setPhase('sending')
    setError('')
    try {
      const value = await marketplaceApi.order(current.payload, current.key)
      if (token === getAccessToken()) receive(value, current)
    } catch (cause) {
      if (token !== getAccessToken()) return
      setError(apiErrorMessage(cause))
      const definitive =
        isAxiosError(cause) &&
        !!cause.response &&
        cause.response.status >= 400 &&
        cause.response.status < 500
      if (definitive) {
        save(null)
        setPhase('error')
      } else {
        setPhase('recovering')
        try {
          const found = await marketplaceApi.getOrderByAttempt(current.key)
          if (token !== getAccessToken()) return
          if (found) receive(found, current)
          else setPhase('unknown')
        } catch {
          setPhase('unknown')
        }
      }
    } finally {
      lock.current = false
    }
  }
  return {
    attempt,
    checkingEntry,
    phase,
    error,
    order,
    send,
    clear: () => {
      save(null)
      setError('')
      setPhase('idle')
    },
  }
}
