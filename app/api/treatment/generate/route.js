import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(request) {
  try {
    const { analysis, selectedAngle, selectedStructure, scriptText, customNotes } = await request.json();

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: `Sos un director creativo senior de publicidad. Creá un CREATIVE TREATMENT profesional y completo en HTML para el siguiente comercial.

ANÁLISIS DEL GUION:
${JSON.stringify(analysis, null, 2)}

ÁNGULO CREATIVO ELEGIDO:
${JSON.stringify(selectedAngle, null, 2)}

ESTRUCTURA NARRATIVA ELEGIDA:
${JSON.stringify(selectedStructure, null, 2)}

GUION ORIGINAL:
${scriptText}

${customNotes ? `NOTAS ADICIONALES DEL DIRECTOR:\n${customNotes}` : ""}

Generá un treatment completo en HTML. El HTML debe:
1. Ser un documento visualmente impactante y profesional
2. Usar la paleta de colores del ángulo elegido
3. Incluir secciones claras: Portada, Concepto, Tono & Estilo, Desglose de Escenas (scene-by-scene), Dirección de Arte, Casting/Talento, Música & Sonido, Consideraciones de Producción
4. Para cada escena, incluir: descripción visual detallada, encuadres sugeridos, iluminación, movimiento de cámara
5. Usar tipografías de Google Fonts que vayan con el estilo
6. Incluir placeholders de imagen usando https://placehold.co/ con dimensiones y colores que representen el mood (ej: https://placehold.co/800x450/1a1a2e/e0e0e0?text=Escena+1+-+Interior+Noche)
7. Ser responsive y verse bien impreso
8. Incluir CSS inline completo
9. No usar JavaScript

Respondé ÚNICAMENTE con el código HTML completo, empezando con <!DOCTYPE html> y terminando con </html>. No incluyas markdown ni backticks.`,
        },
      ],
    });

    const html = message.content[0].text;

    return Response.json({ html });
  } catch (error) {
    console.error("Generate error:", error);
    return Response.json(
      { error: "Error al generar el treatment: " + error.message },
      { status: 500 }
    );
  }
}
