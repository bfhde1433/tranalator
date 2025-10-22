import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, model, prompt, isJson, isBulk, languages } = body;

    if (!apiKey || !model || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, model, or prompt' },
        { status: 400 }
      );
    }

    console.log('[API] Translation request received for model:', model);
    console.log('[API] Prompt length:', prompt.length);
    console.log('[API] Is JSON translation:', isJson);
    console.log('[API] Is bulk translation:', isBulk);
    console.log('[API] Languages for bulk:', languages);

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Configure generation - temporarily disable structured output for JSON
    // as it's causing key changes
    const generationConfig: {
      temperature: number;
      topK: number;
      topP: number;
      maxOutputTokens: number;
    } = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 30000,
    };

    const geminiModel = genAI.getGenerativeModel({ 
      model,
      generationConfig
    });

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('[API] Translation successful, response length:', text.length);

    // If it's a bulk translation, try to parse the response
    if (isBulk && languages) {
      try {
        // The response should contain translations for all requested languages
        // We'll parse it on the frontend since the format might vary
        return NextResponse.json({ 
          text,
          isBulk: true,
          languages 
        });
      } catch (parseError) {
        console.error('[API] Failed to parse bulk response:', parseError);
        // Return the raw text and let frontend handle it
        return NextResponse.json({ 
          text,
          isBulk: true,
          languages,
          parseError: true 
        });
      }
    }

    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error('[API] Translation error:', error);
    
    let errorMessage = 'Translation failed';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('API key not valid')) {
        errorMessage = 'Invalid API key. Please check your Gemini API key.';
        statusCode = 401;
      } else if (error.message.includes('model not found')) {
        errorMessage = 'Model not found. Please check the model name.';
        statusCode = 404;
      } else if (error.message.includes('quota')) {
        errorMessage = 'API quota exceeded. Please try again later.';
        statusCode = 429;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
