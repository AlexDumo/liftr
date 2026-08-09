import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import type { IncomingRequestCfProperties } from '@cloudflare/workers-types'
import { eq } from 'drizzle-orm'
import { getDb } from '#/db'
import { users } from '#/db/auth.schema'
import { createAuth } from '#/lib/auth'
import type { AuthEnv } from '#/lib/auth'

const LOCAL_DEV_USER_ID = 'local-dev-user'
const LOCAL_DEV_SESSION_ID = 'local-dev-session'

async function ensureLocalDevUser() {
  const db = getDb()
  const now = new Date()

  await db
    .insert(users)
    .values({
      id: LOCAL_DEV_USER_ID,
      name: 'Local Host',
      email: 'local@localhost',
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: 'local@localhost',
        emailVerified: true,
        updatedAt: now,
      },
    })
}

async function localDevSession() {
  await ensureLocalDevUser()

  const db = getDb()
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, LOCAL_DEV_USER_ID))
    .limit(1)

  const user = rows[0]
  if (!user) {
    throw new Error('Failed to load local dev user')
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365)

  return {
    session: {
      id: LOCAL_DEV_SESSION_ID,
      userId: LOCAL_DEV_USER_ID,
      token: 'local-dev-token',
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: '127.0.0.1',
      userAgent: 'local-dev',
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  }
}

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (import.meta.env.DEV) {
      return localDevSession()
    }

    const request = getRequest()
    const auth = createAuth(
      env as AuthEnv,
      request.cf as IncomingRequestCfProperties | undefined,
      new URL(request.url).origin,
    )
    return auth.api.getSession({ headers: request.headers })
  },
)
