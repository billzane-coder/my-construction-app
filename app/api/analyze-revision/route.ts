import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image } = body; // This is the base64 string from your frontend html-to-image capture

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Strip the "data:image/jpeg;base64," prefix if it exists
    const base64Data = image.replace(/^data:image\/(png|jpeg);base64,/, "");

    // Prepare the payload for a Vision API (Example: Gemini 1.5 Pro)
    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: "You are an expert construction estimator and project manager. Analyze this architectural plan overlay. The image shows two versions of a blueprint superimposed. Detail any structural, envelope, or interior layout changes you can identify. Be concise and format your response as a bulleted site-report." },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }
      ]
    };

    // Call the external AI API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    const aiResult = await response.json();
    
    // Extract the text response
    const reportText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || "Analysis failed to generate a report.";

    return NextResponse.json({ text: reportText });

  } catch (error) {
    console.error('AI Analysis Error:', error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}