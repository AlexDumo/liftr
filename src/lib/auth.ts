import type {
  D1Database,
  IncomingRequestCfProperties,
  KVNamespace,
} from '@cloudflare/workers-types'
import { betterAuth, APIError } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { passkey } from '@better-auth/passkey'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { withCloudflare } from 'better-auth-cloudflare'
import { drizzle } from 'drizzle-orm/d1'
import { schema } from '#/db/schema'

export type AuthEnv = {
  DATABASE: D1Database
  KV: KVNamespace
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
}

type SignupContext = {
  email?: string
  name?: string
}

function createAuth(
  env?: AuthEnv,
  cf?: IncomingRequestCfProperties,
  baseURL?: string,
) {
  const db = env
    ? drizzle(env.DATABASE, { schema, logger: true })
    : ({} as ReturnType<typeof drizzle>)

  return betterAuth({
    baseURL: baseURL ?? env?.BETTER_AUTH_URL,
    secret: env?.BETTER_AUTH_SECRET,
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: cf || {},
        d1: env
          ? {
              db,
              options: {
                usePlural: true,
                debugLogs: true,
              },
            }
          : undefined,
        kv: env?.KV,
      },
      {
        rateLimit: {
          enabled: true,
          window: 60,
          max: 100,
          customRules: {
            '/sign-in/passkey': {
              window: 60,
              max: 100,
            },
            '/passkey/generate-register-options': {
              window: 60,
              max: 100,
            },
            '/passkey/generate-authenticate-options': {
              window: 60,
              max: 100,
            },
          },
        },
        plugins: [
          tanstackStartCookies(),
          passkey({
            rpName: 'Liftr',
            registration: {
              requireSession: false,
              resolveUser: async ({ ctx, context }) => {
                if (!context) {
                  throw APIError.from('BAD_REQUEST', {
                    message: 'Missing signup context',
                    code: 'MISSING_SIGNUP_CONTEXT',
                  })
                }

                let payload: SignupContext
                try {
                  payload = JSON.parse(context) as SignupContext
                } catch {
                  throw APIError.from('BAD_REQUEST', {
                    message: 'Invalid signup context',
                    code: 'INVALID_SIGNUP_CONTEXT',
                  })
                }

                const email = payload.email?.trim().toLowerCase()
                const name = payload.name?.trim()
                if (!email || !name) {
                  throw APIError.from('BAD_REQUEST', {
                    message: 'Email and name are required',
                    code: 'INVALID_SIGNUP_FIELDS',
                  })
                }

                const existing =
                  await ctx.context.internalAdapter.findUserByEmail(email)
                if (existing?.user) {
                  const existingPasskeys = await ctx.context.adapter.findMany({
                    model: 'passkey',
                    where: [
                      {
                        field: 'userId',
                        value: existing.user.id,
                      },
                    ],
                  })
                  if (existingPasskeys.length > 0) {
                    throw APIError.from('BAD_REQUEST', {
                      message: 'Account already exists. Sign in with your passkey.',
                      code: 'ACCOUNT_EXISTS',
                    })
                  }
                  return {
                    id: existing.user.id,
                    name: existing.user.email,
                    displayName: existing.user.name,
                  }
                }

                const user = await ctx.context.internalAdapter.createUser({
                  email,
                  name,
                  emailVerified: false,
                })
                return {
                  id: user.id,
                  name: user.email,
                  displayName: user.name,
                }
              },
            },
          }),
        ],
      },
    ),
    ...(env
      ? {}
      : {
          database: drizzleAdapter({} as D1Database, {
            provider: 'sqlite',
            usePlural: true,
            debugLogs: true,
          }),
        }),
  })
}

export const auth = createAuth()
export { createAuth }
