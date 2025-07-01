import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '../../../lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Mock settings storage (in production, you'd store this in database)
const defaultSettings = {
  maintenanceMode: false,
  registrationEnabled: true,
  maxTradesPerUser: 1000,
  maxUsersAllowed: 10000,
  systemMessage: '',
  backupEnabled: true,
  emailNotifications: false
}

// Zod schema to strictly validate incoming settings updates
const settingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),
  maxTradesPerUser: z.number().int().positive().optional(),
  maxUsersAllowed: z.number().int().positive().optional(),
  systemMessage: z.string().optional(),
  backupEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
}).strict()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the current user to check role
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // In a real app, you'd fetch from database
    // For now, return default settings
    return NextResponse.json({ settings: defaultSettings })
  } catch (error) {
    console.error('Admin settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the current user to check role
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate request body against schema – reject unknown or malformed fields
    const settings = settingsSchema.parse(await request.json())

    // Log the settings change
    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: 'SETTINGS_UPDATED',
        resource: 'SystemSettings',
        metadata: JSON.stringify(settings)
      }
    })

    // In a real app, you'd save to database
    // For now, just return success
    return NextResponse.json({
      message: 'Settings updated successfully',
      settings,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Admin settings update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 