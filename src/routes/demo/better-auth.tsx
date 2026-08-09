import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getAuthenticatorName } from '@better-auth/passkey'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/demo/better-auth')({
  component: BetterAuthDemo,
})

type PasskeyRow = {
  id: string
  name?: string | null
  aaguid?: string | null
  createdAt?: Date | string | null
  deviceType?: string | null
}

function BetterAuthDemo() {
  const { data: session, isPending } = authClient.useSession()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([])
  const [passkeysLoading, setPasskeysLoading] = useState(false)
  const [geo, setGeo] = useState<{
    city?: string | null
    country?: string | null
    region?: string | null
    timezone?: string | null
  } | null>(null)

  const loadGeolocation = async () => {
    const result = await authClient.cloudflare.geolocation()
    if (result.error) {
      setError(result.error.message || 'Failed to load geolocation')
      return
    }
    if (result.data && !('error' in result.data)) {
      setGeo({
        city: result.data.city,
        country: result.data.country,
        region: result.data.region,
        timezone: result.data.timezone,
      })
    }
  }

  const loadPasskeys = async () => {
    setPasskeysLoading(true)
    try {
      const result = await authClient.passkey.listUserPasskeys()
      if (result.error) {
        setError(result.error.message || 'Failed to load passkeys')
        return
      }
      setPasskeys((result.data as PasskeyRow[]) ?? [])
    } finally {
      setPasskeysLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      void loadPasskeys()
    } else {
      setPasskeys([])
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (session?.user || isSignUp) return
    if (
      !PublicKeyCredential.isConditionalMediationAvailable ||
      !PublicKeyCredential.isConditionalMediationAvailable()
    ) {
      return
    }
    void authClient.signIn.passkey({ autoFill: true })
  }, [session?.user, isSignUp])

  if (isPending) {
    return (
      <main className="demo-page demo-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-800 dark:border-t-neutral-100" />
      </main>
    )
  }

  if (session?.user) {
    return (
      <main className="demo-page demo-center">
        <section className="demo-panel w-full max-w-md space-y-6">
          <div className="space-y-1.5">
            <p className="island-kicker mb-2">Better Auth</p>
            <h1 className="demo-title">Welcome back</h1>
            <p className="demo-muted text-sm">
              You're signed in as {session.user.email}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="h-10 w-10" />
            ) : (
              <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  {session.user.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {session.user.email}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Passkeys</h2>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void (async () => {
                    setError('')
                    setLoading(true)
                    try {
                      const result = await authClient.passkey.addPasskey({
                        name: 'Additional passkey',
                      })
                      if (result.error) {
                        setError(
                          result.error.message || 'Failed to add passkey',
                        )
                        return
                      }
                      await loadPasskeys()
                    } catch {
                      setError('An unexpected error occurred')
                    } finally {
                      setLoading(false)
                    }
                  })()
                }}
                className="demo-muted text-xs transition-colors hover:text-[var(--sea-ink)]"
              >
                Add passkey
              </button>
            </div>

            {passkeysLoading ? (
              <p className="demo-muted text-sm">Loading passkeys…</p>
            ) : passkeys.length === 0 ? (
              <p className="demo-muted text-sm">No passkeys registered yet.</p>
            ) : (
              <ul className="space-y-2">
                {passkeys.map((item) => {
                  const label =
                    item.name ||
                    getAuthenticatorName(item.aaguid) ||
                    'Passkey'
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{label}</p>
                        {item.deviceType && (
                          <p className="demo-muted text-xs">{item.deviceType}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          void (async () => {
                            setError('')
                            setLoading(true)
                            try {
                              const result =
                                await authClient.passkey.deletePasskey({
                                  id: item.id,
                                })
                              if (result.error) {
                                setError(
                                  result.error.message ||
                                    'Failed to delete passkey',
                                )
                                return
                              }
                              await loadPasskeys()
                            } catch {
                              setError('An unexpected error occurred')
                            } finally {
                              setLoading(false)
                            }
                          })()
                        }}
                        className="demo-muted shrink-0 text-xs transition-colors hover:text-red-600"
                      >
                        Delete
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {error && (
            <div className="demo-alert demo-alert-danger">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              void loadGeolocation()
            }}
            className="demo-button demo-button-secondary w-full"
          >
            Show Cloudflare geolocation
          </button>

          {geo && (
            <div className="demo-muted space-y-1 text-sm">
              <p>
                {[geo.city, geo.region, geo.country].filter(Boolean).join(', ') ||
                  'Location unavailable'}
              </p>
              {geo.timezone && <p>Timezone: {geo.timezone}</p>}
            </div>
          )}

          <button
            onClick={() => {
              void authClient.signOut()
            }}
            className="demo-button demo-button-secondary w-full"
          >
            Sign out
          </button>

          <p className="demo-muted text-center text-xs">
            Built with{' '}
            <a
              href="https://better-auth.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium"
            >
              BETTER-AUTH
            </a>
            .
          </p>
        </section>
      </main>
    )
  }

  const handleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await authClient.signIn.passkey()
      if (result.error) {
        setError(result.error.message || 'Sign in failed')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const context = JSON.stringify({
        email: email.trim().toLowerCase(),
        name: name.trim(),
      })
      const registerResult = await authClient.passkey.addPasskey({
        name: 'Primary passkey',
        context,
      })
      if (registerResult.error) {
        setError(registerResult.error.message || 'Sign up failed')
        return
      }

      const signInResult = await authClient.signIn.passkey()
      if (signInResult.error) {
        setError(
          signInResult.error.message ||
            'Passkey created, but sign in failed. Try signing in.',
        )
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="demo-page demo-center">
      <section className="demo-panel w-full max-w-md">
        <p className="island-kicker mb-2">Better Auth</p>
        <h1 className="demo-title">
          {isSignUp ? 'Create an account' : 'Sign in'}
        </h1>
        <p className="demo-muted mt-2 mb-6 text-sm">
          {isSignUp
            ? 'Enter your details, then create a passkey'
            : 'Use your passkey to sign in'}
        </p>

        {isSignUp ? (
          <form onSubmit={handleSignUp} className="grid gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="name"
                className="text-sm font-medium leading-none"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="demo-input"
                autoComplete="name"
                required
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="demo-input"
                autoComplete="username webauthn"
                required
              />
            </div>

            {error && (
              <div className="demo-alert demo-alert-danger">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="demo-button w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-white dark:border-neutral-600 dark:border-t-neutral-900" />
                  <span>Please wait</span>
                </span>
              ) : (
                'Create passkey account'
              )}
            </button>
          </form>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="email-signin"
                className="text-sm font-medium leading-none"
              >
                Email
              </label>
              <input
                id="email-signin"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="demo-input"
                autoComplete="username webauthn"
                placeholder="Optional for autofill"
              />
            </div>

            {error && (
              <div className="demo-alert demo-alert-danger">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void handleSignIn()
              }}
              className="demo-button w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-white dark:border-neutral-600 dark:border-t-neutral-900" />
                  <span>Please wait</span>
                </span>
              ) : (
                'Sign in with passkey'
              )}
            </button>
          </div>
        )}

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            className="demo-muted text-sm transition-colors hover:text-[var(--sea-ink)]"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>

        <p className="demo-muted mt-6 text-center text-xs">
          Built with{' '}
          <a
            href="https://better-auth.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium"
          >
            BETTER-AUTH
          </a>
          .
        </p>
      </section>
    </main>
  )
}
