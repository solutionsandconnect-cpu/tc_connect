import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebaseAdmin'

// Révoque tous les refresh tokens de l'utilisateur → les autres appareils connectés
// (avec l'ancien mot de passe) seront déconnectés à leur prochaine actualisation de session.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    await getAdminAuth().revokeRefreshTokens(decoded.uid)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
