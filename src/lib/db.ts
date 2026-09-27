import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || ''

  // Debug: log what env vars are available (sem expor valores sensíveis)
  if (!url) {
    console.error('[DB] DATABASE_URL não definida! Env vars disponíveis:', 
      Object.keys(process.env).filter(k => !k.startsWith('npm_') && !k.startsWith('VERCEL_') && !k.startsWith('NEXT_')).join(', ')
    )
  }

  // Se DATABASE_URL não estiver definida, usa fallback local (só funciona em dev)
  const dbUrl = url || 'file:./db/custom.db'

  // Se a URL começa com "libsql://", usa o adapter do Turso (libSQL)
  if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('libsql:')) {
    console.log('[DB] Usando Turso (libSQL):', dbUrl.replace(/\/[^/]+\.turso\.io/, '/***.turso.io'))
    const libsql = createClient({
      url: dbUrl,
      authToken: authToken || undefined,
    })
    const adapter = new PrismaLibSql(libsql)
    return new PrismaClient({ adapter })
  }

  // Caso contrário, usa SQLite local (desenvolvimento)
  console.log('[DB] Usando SQLite local:', dbUrl)
  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
