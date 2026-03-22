import { NextResponse } from "next/server";

const PIN = process.env.BICHA_ADMIN_PIN || "1234";

export async function POST(req) {
  const { pin } = await req.json();
  if (pin === PIN) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
}
