import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, model, prompt, isJson } = body;

    if (!apiKey || !model || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, model, or prompt' },
        { status: 400 }
      );
    }

    console.log('[API] Translation request received for model:', model);
    console.log('[API] Prompt length:', prompt.length);
    console.log('[API] Is JSON translation:', isJson);

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Configure generation - temporarily disable structured output for JSON
    // as it's causing key changes
    const generationConfig: any = {
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

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('[API] Translation error:', error);
    
    let errorMessage = 'Translation failed';
    let statusCode = 500;

    if (error.message?.includes('API key not valid')) {
      errorMessage = 'Invalid API key. Please check your Gemini API key.';
      statusCode = 401;
    } else if (error.message?.includes('model not found')) {
      errorMessage = 'Model not found. Please check the model name.';
      statusCode = 404;
    } else if (error.message?.includes('quota')) {
      errorMessage = 'API quota exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
} 