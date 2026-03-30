import { NextResponse } from "next/server";
import { getOAuth2Client } from "../../../../lib/google-calendar";
import { writeFile } from "fs/promises";
import { join } from "path";

// GET /api/calendar/callback
// Handles Google OAuth callback, exchanges code for tokens
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json({ error: `OAuth error: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "No authorization code received" }, { status: 400 });
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Try to auto-append to .env.local
    let autoSaved = false;
    if (tokens.refresh_token) {
      try {
        const envPath = join(process.cwd(), ".env.local");
        const envLine = `\n# Google Calendar (auto-saved)\nGOOGLE_CALENDAR_REFRESH_TOKEN=${tokens.refresh_token}\n`;
        await writeFile(envPath, envLine, { flag: "a" });
        autoSaved = true;
      } catch {
        // Can't write in production (Vercel), that's fine
      }
    }

    // Render a nice HTML page with the result
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Calendar Connected</title>
<style>body{font-family:system-ui;max-width:500px;margin:60px auto;padding:20px;text-align:center}
.ok{color:#2D7A4F;font-size:48px}.code{background:#f5f5f5;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;word-break:break-all;text-align:left;margin:16px 0}</style></head>
<body>
<div class="ok">&#10003;</div>
<h2>Google Calendar conectado!</h2>
<p>Cuenta: <strong>chuibandejas@gmail.com</strong></p>
${autoSaved ? '<p style="color:#2D7A4F">Token guardado en .env.local automaticamente. Reinicia el server (<code>npm run dev</code>) para activarlo.</p>' : `
<p>Agrega esto a tu <code>.env.local</code>:</p>
<div class="code">GOOGLE_CALENDAR_REFRESH_TOKEN=${tokens.refresh_token || "NO_REFRESH_TOKEN_RECEIVED"}</div>
<p style="color:#999;font-size:13px">Luego reinicia el server.</p>
`}
<p><a href="/host">Volver al panel</a></p>
</body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
