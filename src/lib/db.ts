import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Turso connection — fallback hardcoded (idealmente usar só env vars)
const TURSO_URL = 'libsql://gestao-odonto-frsouzast.aws-us-east-2.turso.io'
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTA1NDk2NDAsImlkIjoiMDFhMGU0MDAtMzcwMS03ZDA1LWEyZjItYmQxNjljYmVkODdlIiwia2lkIjoiUjI2N0VzTjdnVkRERFAwWXNDVXBBcnVTQzRYM2RhUlVNRHVvRTliNXFZRSIsInJpZCI6Ijk2OTc1OGJjLTUzNDgtNGE4OC05YzdmLTA0NDRjNzA0MTcyZSJ9.kX6c-4TsXbhn_cAtBtsqphxv7ybbtE-yYt5DoiTfu6M6BHOQPVt_32BXW0dsYpL0RKCu1eVlZUQ4t7DeRZ8LBw'

function createPrismaClient() {
  // Tenta env vars primeiro, senão usa hardcoded
  const url = process.env.DATABASE_URL || TURSO_URL
  const authToken = process.env.TURSO_AUTH_TOKEN || TURSO_TOKEN

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = url
  }

  if (url.startsWith('libsql://') || url.startsWith('libsql:')) {
    const adapter = new PrismaLibSql({ url, authToken })
    return new PrismaClient({ adapter })
  }

  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
