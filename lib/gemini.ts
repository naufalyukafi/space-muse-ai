import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateInteriorDesign(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }

  console.log(`[Gemini] Initiating redesign generation. Buffer size: ${(imageBuffer.length / 1024).toFixed(2)} KB, Mimetype: ${mimeType}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-image"
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn("[Gemini] Request triggered AbortController timeout threshold (45s).");
    controller.abort();
  }, 45000); // 45 seconds timeout

  try {
    const requestPayload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType: 'image/jpeg',
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
      },
    };

    console.log("[Gemini] Sending generateContent request to Google AI API...");
    const apiStartTime = Date.now();
    
    const result = await model.generateContent(
      requestPayload as unknown as import("@google/generative-ai").GenerateContentRequest,
      {
        signal: controller.signal,
      }
    );

    console.log(`[Gemini] Google AI API responded successfully in ${((Date.now() - apiStartTime) / 1000).toFixed(2)}s`);

    const response = result.response;
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;
    
    if (!parts) {
      console.warn("[Gemini] Response parts are undefined.");
      throw new Error("EMPTY_RESPONSE");
    }

    // Find the generated image part in the response
    const imagePart = parts.find(
      (part) => part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith("image/")
    );

    if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
      console.warn("[Gemini] No image part found in the candidates.");
      throw new Error("EMPTY_RESPONSE");
    }

    return Buffer.from(imagePart.inlineData.data, "base64");
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    console.error(`[Gemini] Error caught: Name=${err.name}, Message="${err.message}"`);

    if (err.name === "AbortError" || controller.signal.aborted) {
      throw new Error("TIMEOUT");
    }
    
    const errorMessage = err.message || "";
    if (
      errorMessage.toLowerCase().includes("timeout") ||
      errorMessage.toLowerCase().includes("deadline") ||
      err.status === 504
    ) {
      throw new Error("TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
