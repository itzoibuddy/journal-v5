import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../auth/[...nextauth]/route'
import { prisma } from '../../../../../lib/db'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

// Generate a secure temporary password
function generateTempPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*'
  
  // Ensure at least one character from each set
  let password = ''
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]
  
  // Fill the rest randomly
  const allChars = uppercase + lowercase + numbers + symbols
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is admin
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!adminUser || (adminUser.role !== 'ADMIN' && adminUser.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const userId = params.id

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Generate temporary password
    const tempPassword = generateTempPassword()
    const hashedPassword = await bcrypt.hash(tempPassword, 12)

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    // Log the password generation action
    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'TEMP_PASSWORD_GENERATED',
        resource: 'User',
        resourceId: userId,
        metadata: JSON.stringify({ 
          adminId: adminUser.id,
          adminEmail: adminUser.email,
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          timestamp: new Date().toISOString()
        })
      }
    })

    return NextResponse.json({ 
      message: 'Temporary password generated successfully',
      temporaryPassword: tempPassword,
      userId: userId,
      userEmail: targetUser.email,
      warning: 'This password should be shared securely with the user and they should change it immediately after login.'
    })

  } catch (error) {
    console.error('Generate temp password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 