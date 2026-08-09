import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import type { IncomingRequestCfProperties } from '@cloudflare/workers-types'
import { createAuth } from '#/lib/auth'
import type { AuthEnv } from '#/lib/auth'

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const auth = createAuth(
      env as AuthEnv,
      request.cf as IncomingRequestCfProperties | undefined,
      new URL(request.url).origin,
    )
    return auth.api.getSession({ headers: request.headers })
  },
)
