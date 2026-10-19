import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { EXERCISES_DIR, MEDIA_VIDEOS_DIR } from '@gpower/catalog-core'
import { config } from './config.js'
import { registerCatalogRoutes } from './routes.js'
import { registerAuthRoutes } from './routes-auth.js'
import { registerChatRoutes } from './routes-chat.js'
import { registerTabataRoutes } from './routes-tabata.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: true, credentials: true })

await app.register(fastifyStatic, {
  root: EXERCISES_DIR,
  prefix: '/images/',
  decorateReply: false,
  maxAge: '1y',
  immutable: true,
})

await app.register(fastifyStatic, {
  root: MEDIA_VIDEOS_DIR,
  prefix: '/gifs/',
  decorateReply: false,
  maxAge: '1y',
  immutable: true,
})

await registerCatalogRoutes(app)
await registerAuthRoutes(app)
await registerChatRoutes(app)
await registerTabataRoutes(app)

try {
  await app.listen({ port: config.port, host: '0.0.0.0' })
  app.log.info(`gpower api on http://localhost:${config.port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
