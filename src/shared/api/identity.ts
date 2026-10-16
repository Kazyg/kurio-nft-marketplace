const tokenKey = 'kurio.accessToken'
const guestKey = 'kurio.guestId'

export function getAccessToken() {
  return localStorage.getItem(tokenKey)
}
export function setAccessToken(token: string) {
  localStorage.setItem(tokenKey, token)
}
export function clearAccessToken() {
  localStorage.removeItem(tokenKey)
}
export function getGuestId() {
  let id = localStorage.getItem(guestKey)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(guestKey, id)
  }
  return id
}
