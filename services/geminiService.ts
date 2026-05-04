import { GoogleGenAI } from "@google/genai";

// NOTE: In a real deployment, ensure API_KEY is set in environment variables.
// For this generated code to work, the user must provide the key.
const API_KEY = process.env.API_KEY || ''; 

let client: GoogleGenAI | null = null;

if (API_KEY) {
  client = new GoogleGenAI({ apiKey: API_KEY });
}

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  if (!client) {
      console.warn("Gemini API Key is missing.");
      return "Erro: Chave de API não configurada.";
  }

  try {
    // Convert Blob to Base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    const model = 'gemini-2.5-flash-native-audio-preview-12-2025'; // Using the recommended audio model
    
    // As per guidelines, we use generateContent with inline data for audio
    const response = await client.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: base64Audio
            }
          },
          {
            text: "Transcreva este áudio para português do Brasil. Retorne apenas o texto transcrito, sem formatação adicional."
          }
        ]
      }
    });

    return response.text || "Não foi possível transcrever.";

  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    return "Erro ao transcrever áudio.";
  }
};
