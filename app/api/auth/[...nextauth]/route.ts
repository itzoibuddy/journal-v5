/// <reference path="../../../types/next-auth.d.ts" />
import NextAuth from 'next-auth'
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from '../../../lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials): Promise<any> {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const { email, password } = loginSchema.parse(credentials)
          
          const user = await prisma.user.findUnique({
            where: { email }
          })

          if (!user || !user.password) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(password, user.password)
          
          if (!isPasswordValid) {
            return null
          }

          // Update last login
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
          })

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            mobile: user.mobile,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user, trigger, session }): Promise<JWT> {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
        // Fetch user data to get mobile number
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { mobile: true }
        })
        token.mobile = dbUser?.mobile || undefined
      }

      // Handle session update
      if (trigger === 'update' && session) {
        token.name = session.name
        token.email = session.email
      }

      return token
    },
    async session({ session, token }): Promise<Session> {
      if (token && session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).mobile = token.mobile;
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Always redirect to dashboard after successful login
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/`
      }
      // If url is a relative path, make it absolute
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }
      // If url is from the same origin, allow it
      if (new URL(url).origin === baseUrl) {
        return url
      }
      // Default to dashboard
      return `${baseUrl}/`
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email || '' }
          })

          if (existingUser) {
            // Update last login for existing Google users
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { lastLoginAt: new Date() }
            })
          }
          
          return true
        } catch (error) {
          console.error('Google sign in error:', error)
          return false
        }
      }
      
      return true
    },
  },
  pages: {
    signIn: '/signin',
  },
  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser) {
        // Create demo trades for new users
        await createDemoTrades(user.id!)
        
        // Log user creation
        await prisma.auditLog.create({
          data: {
            userId: user.id!,
            action: 'USER_CREATED',
            resource: 'User',
            resourceId: user.id!,
            metadata: JSON.stringify({ isNewUser: true })
          }
        })
      }
    }
  }
}

const handler = NextAuth(authOptions)

async function createDemoTrades(userId: string) {
  const demoTrades = [
    {
      userId,
      symbol: 'AAPL',
      type: 'LONG',
      instrumentType: 'STOCK',
      entryPrice: 150.00,
      exitPrice: 155.00,
      quantity: 10,
      entryDate: new Date('2024-01-15'),
      exitDate: new Date('2024-01-20'),
      profitLoss: 500,
      strategy: 'Breakout',
      notes: 'Clean breakout above resistance',
      isDemo: true,
      tradeRating: 4,
      marketCondition: 'Bullish'
    },
    {
      userId,
      symbol: 'TSLA',
      type: 'SHORT',
      instrumentType: 'STOCK',
      entryPrice: 250.00,
      exitPrice: 240.00,
      quantity: 5,
      entryDate: new Date('2024-01-22'),
      exitDate: new Date('2024-01-25'),
      profitLoss: 500,
      strategy: 'Mean Reversion',
      notes: 'Overbought on RSI, perfect short setup',
      isDemo: true,
      tradeRating: 5,
      marketCondition: 'Bearish'
    },
    {
      userId,
      symbol: 'SPY',
      type: 'LONG',
      instrumentType: 'OPTIONS',
      entryPrice: 2.50,
      exitPrice: 1.80,
      quantity: 2,
      strikePrice: 480,
      optionType: 'CALL',
      premium: 250,
      entryDate: new Date('2024-02-01'),
      exitDate: new Date('2024-02-05'),
      profitLoss: -140,
      strategy: 'Earnings Play',
      notes: 'Market moved against me, cut losses early',
      isDemo: true,
      tradeRating: 2,
      lessons: 'Should have waited for better entry',
      marketCondition: 'Sideways'
    }
  ]

  await prisma.trade.createMany({
    data: demoTrades
  })
}

export { handler as GET, handler as POST, authOptions } 