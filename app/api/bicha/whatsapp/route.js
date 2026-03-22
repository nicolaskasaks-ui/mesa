import { processMessage } from "../../../../lib/bicha-bot";
import { NextResponse } from "next/server";

// Twilio WhatsApp Webhook
// Configure in Twilio Console:
//   Webhook URL: https://your-domain.com/api/bicha/whatsapp
//   Method: POST

// POST — receive incoming WhatsApp message from Twilio
export async function POST(req) {
  try {
    const formData = await req.formData();
    const body = formData.get("Body") || "";
    const from = formData.get("From") || ""; // "whatsapp:+5491123456789"

    // Extract phone number from Twilio format
    const phone = from.replace("whatsapp:+", "").replace(/\D/g, "");

    if (!phone) {
      return twimlResponse("Error: no se pudo identificar tu numero.");
    }

    const response = await processMessage(phone, body);
    return twimlResponse(response);
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return twimlResponse("Ups, hubo un error. Intenta de nuevo escribiendo *hola*.");
  }
}

// GET — webhook verification (Twilio doesn't need this, but good to have)
export async function GET() {
  return NextResponse.json({ status: "WhatsApp bot active", service: "La Bicha" });
}

// Return TwiML response for Twilio
function twimlResponse(message) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`;

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
