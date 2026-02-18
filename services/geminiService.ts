
import { GoogleGenAI, Type } from "@google/genai";
import { JapaneseChar, MnemonicResponse } from "../types";

export const getMnemonicForChar = async (char: JapaneseChar): Promise<MnemonicResponse | null> => {
  try {
    // Create fresh instance right before making an API call to use the most up-to-date API key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Generate a fun and memorable mnemonic for the Japanese character: ${char.char} (${char.type === 'kanji' ? 'Kanji for ' + char.meaning : char.type}). 
    Provide a simple example sentence using this character in Japanese and its translation.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        // Using responseSchema is the recommended way to generate structured JSON
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            character: { type: Type.STRING },
            mnemonic: { type: Type.STRING, description: "A creative story or visual mnemonic to help remember the character." },
            exampleSentence: { type: Type.STRING, description: "A basic N5-level example sentence." },
            translation: { type: Type.STRING, description: "English translation of the example sentence." }
          },
          required: ["character", "mnemonic", "exampleSentence", "translation"]
        }
      }
    });

    // Extracting text output from GenerateContentResponse using the .text property
    if (response.text) {
      return JSON.parse(response.text.trim()) as MnemonicResponse;
    }
    return null;
  } catch (error) {
    console.error("Error fetching mnemonic:", error);
    return null;
  }
};
