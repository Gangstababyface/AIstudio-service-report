import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || ''; // In a real app, ensure this is set securely or via backend proxy
const ai = new GoogleGenAI({ apiKey });

export const analyzeImage = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Analyze this image in the context of a technical service report for industrial CNC machinery. Describe what you see, identifying components and any visible damage or anomalies. Keep it concise." }
        ]
      }
    });
    return response.text || "Could not analyze image.";
  } catch (error) {
    console.error("Gemini Image Analysis Error:", error);
    return "Error analyzing image.";
  }
};

export const extractMachineInfoFromImage = async (base64Data: string, mimeType: string): Promise<{ serialNumber?: string, modelNumber?: string, machineType?: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Extract the following machine information from this nameplate image into a JSON object: 'serialNumber', 'modelNumber', 'machineType' (from Machine Name). If a field is not found, leave it empty." }
        ]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return {};
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Nameplate Extraction Error:", error);
    return {};
  }
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    // Convert Blob to Base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    
    return new Promise((resolve, reject) => {
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Good for fast audio transcription
            contents: {
              parts: [
                { inlineData: { mimeType: audioBlob.type, data: base64data } },
                { text: "Transcribe this audio note accurately." }
              ]
            }
          });
          resolve(response.text || "");
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
    });
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    return "";
  }
};

export const generateSolutionSummary = async (rootCause: string, fix: string, notes: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `
        Context: Industrial Service Report.
        Root Cause: ${rootCause}
        Fix Applied: ${fix}
        Additional Notes: ${notes}
        
        Task: Generate a professional "Solution Summary" paragraph based on the fields above. 
        It should be written in past tense, technical but clear, suitable for a customer to read.
      `,
      config: {
        thinkingConfig: { thinkingBudget: 2048 } // Small budget for reasoning
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Summary Gen Error:", error);
    return "";
  }
};

export const getCoordinatesForAddress = async (address: string): Promise<{lat: number, lng: number} | null> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Find the latitude and longitude for this address: "${address}". Return the result as a valid JSON object with keys "lat" and "lng". Do not include markdown formatting.`,
            config: {
                tools: [{ googleMaps: {} }],
                // responseMimeType: 'application/json' // Not supported with googleMaps tool
            }
        });
        
        const text = response.text || "";
        // Clean up potential markdown code blocks
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Attempt to parse JSON from the text
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        return null;
    } catch (e) {
        console.error("Map grounding error", e);
        return null;
    }
}

export const generateEdgeCaseReportContent = async (): Promise<any> => {
    try {
        const prompt = `
            Generate a JSON object representing the data for a "Stress Test" technical service report for a 5-axis CNC machine.
            The scenario should be a chaotic service visit with multiple complex problems.
            
            Return ONLY valid JSON.
            Structure requirements:
            {
                "summary": "A very long, detailed, multi-paragraph narrative of the visit including specific technical jargon, timestamps, and frustration.",
                "machine": {
                    "serialNumber": "string",
                    "modelNumber": "string",
                    "machineType": "string",
                    "controllerType": "string",
                    "softwareVersion": "string"
                },
                "issues": [
                    {
                        "title": "string",
                        "category": "string (Mechanical|Electrical|Software/Control|Hydraulic)",
                        "urgency": "string (Critical|High|Medium|Low)",
                        "resolved": boolean,
                        "description": "string (long description of the problem)",
                        "proposedFixes": ["string", "string"],
                        "troubleshootingSteps": ["string", "string"],
                        "rootCause": "string (only if resolved)",
                        "fixApplied": "string (only if resolved)",
                        "verifiedBy": "string",
                        "notes": "string",
                        "solutionSummary": "string (only if resolved)"
                    }
                ]
            }
            
            Generate at least 8 issues. Mix resolved and unresolved. Include some extremely long text fields to test UI wrapping.
            Include special characters and technical symbols in the text.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 4096 } // Higher budget for creativity
            }
        });

        const text = response.text;
        if (!text) throw new Error("No data generated");
        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Report Gen Error:", error);
        throw error;
    }
};