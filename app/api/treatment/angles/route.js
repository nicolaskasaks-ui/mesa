import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(request) {
  try {
    const { analysis, scriptText } = await request.json();

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Sos un director creativo senior de publicidad. Basándote en este análisis de guion de comercial, proponé diferentes ángulos creativos y estructuras temáticas para el treatment.

ANÁLISIS DEL GUION:
${JSON.stringify(analysis, null, 2)}

GUION ORIGINAL:
${scriptText}

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "angulos": [
    {
      "id": 1,
      "nombre": "Nombre del ángulo creativo",
      "descripcion": "Descripción detallada del enfoque",
      "estilo_visual": "Descripción del look & feel visual",
      "referencia_visual": "Tipo de fotografía/cinematografía de referencia (ej: 'cinematográfico oscuro tipo Fincher', 'colores saturados pop art', 'documental íntimo')",
      "paleta_colores": ["#hex1", "#hex2", "#hex3", "#hex4"],
      "tipografia_sugerida": "Estilo tipográfico sugerido",
      "ritmo": "Descripción del ritmo/pacing",
      "musica_sugerida": "Tipo de música o referencia",
      "fortalezas": ["fortaleza 1", "fortaleza 2"],
      "riesgos": ["riesgo 1"]
    }
  ],
  "estructuras": [
    {
      "id": 1,
      "nombre": "Nombre de la estructura narrativa",
      "descripcion": "Cómo se organiza narrativamente el comercial",
      "flujo": ["Apertura: ...", "Desarrollo: ...", "Cierre: ..."],
      "ideal_para": "Para qué tipo de mensaje funciona mejor"
    }
  ]
}

Generá exactamente 3 ángulos creativos diversos y 3 estructuras narrativas.`,
        },
      ],
    });

    const text = message.content[0].text;
    const suggestions = JSON.parse(text);

    return Response.json({ suggestions });
  } catch (error) {
    console.error("Angles error:", error);
    return Response.json(
      { error: "Error al generar ángulos: " + error.message },
      { status: 500 }
    );
  }
}
