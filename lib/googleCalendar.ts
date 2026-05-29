// Google Calendar API via Google Identity Services (GIS)
// Setup requis :
//   1. Google Cloud Console → APIs → Google Calendar API → activer
//   2. Credentials → Create → OAuth 2.0 Client ID (Web application)
//   3. Authorised JavaScript origins : http://localhost:3000 + votre domaine de prod
//   4. .env.local → NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com

export const BILLING_CAL_ID = 'q5oid89eu9j11hg20mo245jffc@group.calendar.google.com'
export const RDV_CAL_ID = '7s6f3hro0iru3ql7ojvgen1nb4@group.calendar.google.com'

const SCOPES = 'https://www.googleapis.com/auth/calendar.events'

let tokenClient: any = null
let accessToken: string | null = null
let scriptLoaded = false

function loadGisScript(): Promise<void> {
  return new Promise((resolve) => {
    if (scriptLoaded || (window as any).google?.accounts) {
      scriptLoaded = true
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => { scriptLoaded = true; resolve() }
    document.head.appendChild(script)
  })
}

function buildTokenClient(onToken: (token: string) => void) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID manquant dans .env.local')
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (resp: any) => {
      if (resp.access_token) {
        accessToken = resp.access_token
        onToken(resp.access_token)
      }
    },
  })
}

async function createEventWithToken(token: string, calendarId: string, event: GCalEvent) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
      }),
    }
  )
  if (res.status === 401) {
    accessToken = null
    throw new Error('TOKEN_EXPIRED')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Erreur Calendar API (${res.status})`)
  }
  return res.json()
}

export interface GCalEvent {
  summary: string
  start: Date
  end: Date
  description?: string
  location?: string
}

export async function addToCalendar(calendarId: string, event: GCalEvent): Promise<void> {
  await loadGisScript()

  const tryCreate = (token: string): Promise<void> =>
    createEventWithToken(token, calendarId, event).then(() => undefined)

  if (accessToken) {
    try {
      await tryCreate(accessToken)
      return
    } catch (e: any) {
      if (e.message !== 'TOKEN_EXPIRED') throw e
      accessToken = null
    }
  }

  // Request new token (opens Google popup)
  return new Promise<void>((resolve, reject) => {
    buildTokenClient(async (token) => {
      try {
        await tryCreate(token)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
    tokenClient.requestAccessToken()
  })
}
