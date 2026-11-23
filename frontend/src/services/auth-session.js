const sessionStorageKey = 'tbims.auth-session'
const allowedRoles = new Set([
  'owner',
  'admin',
  'inventoryManager',
  'staff',
  'customer',
])

function isSession(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.token === 'string' &&
    value.token.length > 0 &&
    value.user !== null &&
    typeof value.user === 'object' &&
    !Array.isArray(value.user) &&
    typeof value.user.username === 'string' &&
    value.user.username.length > 0 &&
    allowedRoles.has(value.user.role)
  )
}

export function readStoredSession(storage = globalThis.sessionStorage) {
  const serialized = storage.getItem(sessionStorageKey)
  if (serialized === null) return null

  let session
  try {
    session = JSON.parse(serialized)
  } catch {
    storage.removeItem(sessionStorageKey)
    return null
  }

  if (!isSession(session)) {
    storage.removeItem(sessionStorageKey)
    return null
  }

  return {
    token: session.token,
    user: {
      username: session.user.username,
      role: session.user.role,
    },
  }
}

export function storeSession(session, storage = globalThis.sessionStorage) {
  if (!isSession(session)) {
    throw new TypeError('A valid authenticated session is required.')
  }

  storage.setItem(
    sessionStorageKey,
    JSON.stringify({
      token: session.token,
      user: {
        username: session.user.username,
        role: session.user.role,
      },
    }),
  )
}

export function clearStoredSession(storage = globalThis.sessionStorage) {
  storage.removeItem(sessionStorageKey)
}
