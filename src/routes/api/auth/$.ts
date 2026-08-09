import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import type { IncomingRequestCfProperties } from '@cloudflare/workers-types'
import { createAuth, type AuthEnv } from '#/lib/auth'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const auth = createAuth(
          env as AuthEnv,
          request.cf as IncomingRequestCfProperties | undefined,
          new URL(request.url).origin,
        )
        return auth.handler(request)
      },
      POST: ({ request }: { request: Request }) => {
        const auth = createAuth(
          env as AuthEnv,
          request.cf as IncomingRequestCfProperties | undefined,
          new URL(request.url).origin,
        )
        return auth.handler(request)
      },
    },
  },
})
