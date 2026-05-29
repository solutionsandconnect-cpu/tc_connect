import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser, sendPushToAdmins } from '@/lib/webpush'

export async function POST(req: NextRequest) {
  try {
    const { userId, toAdmins, title, body, url } = await req.json()
    const payload = { title: title || 'TC Connect', body: body || '', url }

    if (toAdmins) {
      await sendPushToAdmins(payload)
    } else if (userId) {
      await sendPushToUser(userId, payload)
    } else {
      return NextResponse.json({ error: 'userId or toAdmins required' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
