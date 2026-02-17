
import { GoogleGenAI, Type, Modality, GenerateContentResponse, VideoGenerationReferenceType } from "@google/genai";
import { GenerationConfig, AgentRole } from "../types";

export class GeminiService {
  /**
   * Helper to get a fresh instance of the SDK
   */
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private getRoleInstruction(role: AgentRole): string {
    switch (role) {
      case 'analyst':
        return "You are an expert Data Analyst. Focus on statistical significance, trends, and actionable insights. When provided with data, output observations as a structured breakdown.";
      case 'coder':
        return "You are a Senior Software Architect. Provide clean, documented, and efficient code. Focus on edge cases and performance.";
      case 'researcher':
        return "You are a Lead Scientific Researcher. Provide deeply cited, objective summaries of complex topics. Maintain a formal and academic tone.";
      default:
        return "You are a helpful and versatile AI Assistant.";
    }
  }

  /**
   * General Text Chat with Roles and Grounding
   */
  async chat(prompt: string, options: { 
    thinking?: boolean, 
    useSearch?: boolean, 
    useMaps?: boolean,
    role?: AgentRole,
    context?: string,
    location?: { latitude: number, longitude: number }
  }) {
    const ai = this.getAI();
    const model = options.thinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const systemInstruction = this.getRoleInstruction(options.role || 'general') + 
      (options.context ? `\n\nUSE THIS CONTEXT TO ANSWER: ${options.context}` : "");

    const config: any = {
      systemInstruction
    };

    if (options.thinking) {
      config.thinkingConfig = { thinkingBudget: 32768 };
    }

    const tools: any[] = [];
    if (options.useSearch) tools.push({ googleSearch: {} });
    if (options.useMaps) {
      tools.push({ googleMaps: {} });
      if (options.location) {
        config.toolConfig = {
          retrievalConfig: { latLng: options.location }
        };
      }
    }

    if (tools.length > 0) config.tools = tools;

    return await ai.models.generateContent({
      model,
      contents: prompt,
      config
    });
  }

  /**
   * Specialized Data Analysis Mode
   */
  async analyzeData(csvContent: string, query: string) {
    const ai = this.getAI();
    return await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Context: Here is a CSV data snippet:\n${csvContent.slice(0, 10000)}\n\nQuery: ${query}`,
      config: {
        systemInstruction: "You are a Data Analyst tool. Analyze the CSV data. If requested, provide data in a format that can be easily visualized. Always start with a high-level summary of the dataset schema.",
        responseMimeType: "text/plain"
      }
    });
  }

  /**
   * Image Generation (Nano Banana Pro)
   */
  async generateImage(prompt: string, config: GenerationConfig) {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio,
          imageSize: config.imageSize || '1K'
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Failed to generate image");
  }

  /**
   * Video Generation (Veo)
   */
  async generateVideo(prompt: string, aspectRatio: '16:9' | '9:16', startImage?: string) {
    const ai = this.getAI();
    const requestPayload: any = {
      model: 'veo-3.1-fast-generate-preview',
      prompt,
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio
      }
    };

    if (startImage) {
      requestPayload.image = {
        imageBytes: startImage.split(',')[1],
        mimeType: 'image/png'
      };
    }

    let operation = await ai.models.generateVideos(requestPayload);

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 8000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed - no download URI returned.");

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async analyzeMedia(prompt: string, mediaData: string, mimeType: string) {
    const ai = this.getAI();
    return await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { data: mediaData.split(',')[1], mimeType } },
          { text: prompt }
        ]
      }
    });
  }
}
