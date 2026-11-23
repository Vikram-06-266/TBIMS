import { useState } from 'react'
import Icon from './Icon.jsx'
import { signIn } from '../services/products-api.js'
import './SignInView.css'

function SignInView({
  initialError = '',
  onClearError,
  onSignIn,
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const visibleError = error || initialError

  function clearFeedback() {
    setError('')
    onClearError?.()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    clearFeedback()

    try {
      const session = await signIn({ username: username.trim(), password })
      onSignIn(session)
    } catch (requestError) {
      if (
        requestError.status === 401 ||
        requestError.code === 'INVALID_CREDENTIALS' ||
        requestError.code === 'UNAUTHENTICATED'
      ) {
        setError('Invalid username or password. Please verify your credentials and try again.')
      } else {
        setError(requestError.message || 'Sign-in failed. Please check your connection and try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="sign-in-page">
      <div className="sign-in-container">
        <section className="sign-in-card" aria-labelledby="sign-in-title">
          <div className="sign-in-brand">
            <span className="sign-in-brand__mark"><Icon name="box" size={24} /></span>
            <span>
              <strong>TBIMS</strong>
              <small>RETAIL OPERATIONS</small>
            </span>
          </div>

          <p className="eyebrow">TRANSACTION-BASED INVENTORY MANAGEMENT SYSTEM</p>
          <h1 id="sign-in-title">Sign in to your account</h1>
          <p className="sign-in-description">
            Enter your username and password to access the TBIMS portal.
          </p>

          {visibleError && (
            <div className="sign-in-error" id="sign-in-error" role="alert">
              {visibleError}
            </div>
          )}

          <form
            aria-busy={busy}
            aria-describedby={visibleError ? 'sign-in-error' : undefined}
            className="sign-in-form"
            onSubmit={handleSubmit}
          >
            <label className="form-field">
              <span>Username</span>
              <input
                autoComplete="username"
                name="username"
                onChange={(event) => {
                  setUsername(event.target.value)
                  clearFeedback()
                }}
                required
                disabled={busy}
                value={username}
                placeholder="Enter username"
              />
            </label>

            <label className="form-field">
              <span>Password</span>
              <span className="sign-in-password">
                <input
                  aria-label="Password"
                  autoComplete="current-password"
                  name="password"
                  onChange={(event) => {
                    setPassword(event.target.value)
                    clearFeedback()
                  }}
                  required
                  disabled={busy}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  placeholder="Enter password"
                />
                <button
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="sign-in-password__toggle"
                  disabled={busy}
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>

            <button className="button button--primary sign-in-submit" disabled={busy} type="submit">
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <footer className="sign-in-footer">
            <small className="muted-text">TBIMS Enterprise Inventory Platform · All rights reserved</small>
          </footer>
        </section>
      </div>
    </main>
  )
}

export default SignInView
