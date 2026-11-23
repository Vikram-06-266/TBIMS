import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearStoredSession,
  readStoredSession,
  storeSession,
} from '../src/services/auth-session.js'

function createStorage(initialValue = null) {
  let value = initialValue
  return {
    getItem() {
      return value
    },
    setItem(_key, nextValue) {
      value = nextValue
    },
    removeItem() {
      value = null
    },
    get value() {
      return value
    },
  }
}

test('stores only the authenticated token and user for this browser tab', () => {
  const storage = createStorage()
  const session = {
    token: 'signed-token',
    user: { username: 'admin', role: 'admin' },
    requestId: 'not-persisted',
  }

  storeSession(session, storage)

  assert.deepEqual(readStoredSession(storage), {
    token: 'signed-token',
    user: { username: 'admin', role: 'admin' },
  })
  assert.equal(storage.value.includes('requestId'), false)
})

test('clears malformed and unsupported stored sessions', () => {
  const malformedStorage = createStorage('{')
  assert.equal(readStoredSession(malformedStorage), null)
  assert.equal(malformedStorage.value, null)

  const invalidRoleStorage = createStorage(JSON.stringify({
    token: 'signed-token',
    user: { username: 'admin', role: 'superuser' },
  }))
  assert.equal(readStoredSession(invalidRoleStorage), null)
  assert.equal(invalidRoleStorage.value, null)

  const ownerStorage = createStorage(JSON.stringify({
    token: 'signed-token',
    user: { username: 'owner', role: 'owner' },
  }))
  assert.equal(readStoredSession(ownerStorage).user.role, 'owner')

  const customerStorage = createStorage(JSON.stringify({
    token: 'signed-token',
    user: { username: 'customer', role: 'customer' },
  }))
  assert.equal(readStoredSession(customerStorage).user.role, 'customer')
})

test('clears the tab session on sign-out', () => {
  const storage = createStorage()
  storeSession({
    token: 'signed-token',
    user: { username: 'admin', role: 'admin' },
  }, storage)

  clearStoredSession(storage)

  assert.equal(readStoredSession(storage), null)
})
