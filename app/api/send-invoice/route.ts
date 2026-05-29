import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const data = await req.json();

  console.log("Send invoice:", data);

  // 👉 ici tu branches Resend / Gmail / Sendgrid

  return NextResponse.json({ ok: true });
}