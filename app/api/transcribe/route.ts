// app/api/transcribe/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function retryOperation(operation: () => Promise<any>, retries: number = MAX_RETRIES): Promise<any> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0 && error instanceof Error && 
       (error.message.includes('ECONNRESET') || 
        error.message.includes('Connection error') ||
        error.message.includes('network') ||
        error.message.includes('timeout'))) {
      console.log(`Retrying operation. Attempts left: ${retries - 1}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryOperation(operation, retries - 1);
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Convert the blob to a Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a temporary file with the correct MIME type
    const file = new File([buffer], 'audio.webm', { 
      type: audioFile.type || 'audio/webm' 
    });

    const response = await retryOperation(async () => {
      return await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
      });
    });

    return NextResponse.json({ transcript: response.text });
  } catch (error: unknown) {
    console.error('Error in transcribe API:', error);
    
    if (error instanceof Error) {
      // Handle specific OpenAI API errors
      if (error.message.includes('Incorrect API key')) {
        return NextResponse.json({ error: 'Invalid API configuration' }, { status: 401 });
      }
      if (error.message.includes('audio file format')) {
        return NextResponse.json({ error: 'Invalid audio format' }, { status: 400 });
      }
      if (error.message.includes('ECONNRESET') || error.message.includes('Connection error')) {
        return NextResponse.json({ error: 'Connection error. Please try again.' }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}