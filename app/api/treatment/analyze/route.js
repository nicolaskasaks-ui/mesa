import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(request) {
  try {
    const { scriptText } = await request.json();

    if (!scriptText || scriptText.trim().length < 20) {
      return Response.json(
        { error: "El guion es demasiado corto o está vacío" },
        { status: 400 }
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Sos un director creativo senior de publicidad. Analizá el siguiente guion de comercial y generá un outline estructurado para un creative treatment.

GUION:
${scriptText}

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "titulo": "Título del proyecto",
  "marca": "Marca/Cliente detectado o 'Sin especificar'",
  "duracion_estimada": "Duración estimada del comercial",
  "resumen": "Resumen ejecutivo de 2-3 oraciones",
  "tema_central": "El tema o mensaje central del comercial",
  "tono": ["lista", "de", "tonos", "detectados"],
  "audiencia_objetivo": "Descripción de la audiencia target",
  "escenas": [
    {
      "numero": 1,
      "titulo": "Título de la escena",
      "descripcion": "Qué pasa en esta escena",
      "elementos_visuales": "Elementos visuales clave",
      "audio": "Diálogos, VO, música o SFX"
    }
  ],
  "elementos_clave": ["elemento 1", "elemento 2"],
  "desafios_produccion": ["desafío 1", "desafío 2"]
}`,
        },
      ],
    });

    const text = message.content[0].text;
    const analysis = JSON.parse(text);

    return Response.json({ analysis });
  } catch (error) {
    console.error("Analysis error:", error);
    return Response.json(
      { error: "Error al analizar el guion: " + error.message },
      { status: 500 }
    );
  }
}
