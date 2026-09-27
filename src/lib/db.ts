import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Turso connection
const TURSO_URL = 'libsql://gestao-odonto-frsouzast.aws-us-east-2.turso.io'
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTA1MzE5NjUsImlkIjoiMDFhMGU0MDAtMzcwMS03ZDA1LWEyZjItYmQxNjljYmVkODdlIiwia2lkIjoiUjI2N0VzTjdnVkRERFAwWXNDVXBBcnVTQzRYM2RhUlVNRHVvRTliNXFZRSIsInJpZCI6Ijk2OTc1OGJjLTUzNDgtNGE4OC05YzdmLTA0NDRjNzA0MTcyZSJ9.AJ52Rla71dBKQbgq55RLZLq4Rcg-IdTdO_mQT2ibBckez6VZ3WeNo5btA22PaGlVeXv2MJ2l1UmWXDWzZkRvBQ'

function createPrismaClient() {
  const url = process.env.DATABASE_URL || TURSO_URL
  const authToken = process.env.TURSO_AUTH_TOKEN || TURSO_TOKEN

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = url
  }

  if (url.startsWith('libsql://') || url.startsWith('libsql:')) {
    // ⚠️ PrismaLibSql recebe CONFIG ({ url, authToken }), não um client!
    // O adapter cria o client internamente via createClient(config).
    const adapter = new PrismaLibSql({ url, authToken })
    return new PrismaClient({ adapter })
  }

  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
