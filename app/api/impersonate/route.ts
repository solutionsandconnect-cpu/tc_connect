import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'

export async function POST(req: Request) {
  try {
    const { adminToken, targetUid } = await req.json()

    if (!adminToken || !targetUid) {
      return NextResponse.json({ error: 'adminToken and targetUid required' }, { status: 400 })
    }

    const adminAuth = getAdminAuth()

    // Verify the admin's token
    const decoded = await adminAuth.verifyIdToken(adminToken)

    // Check admin role in Firestore
    const adminDb = getAdminDb()
    const adminDoc = await adminDb.collection('users').doc(decoded.uid).get()
    if (!adminDoc.exists || adminDoc.data()?.role_app !== 'Admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Don't allow impersonating yourself
    if (decoded.uid === targetUid) {
      return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 })
    }

    // Generate custom token for the target user
    const customToken = await adminAuth.createCustomToken(targetUid)

    return NextResponse.json({ customToken })
  } catch (err: any) {
    console.error('[impersonate]', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
