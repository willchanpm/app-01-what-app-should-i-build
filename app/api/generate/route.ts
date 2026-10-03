import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const getVibePrompt = (vibe: number) => {
  switch (vibe) {
    case 0:
      return "Generate a practical, real-world app idea that solves a common problem.";
    case 1:
      return "Generate a creative and imaginative app idea that offers a unique solution.";
    case 2:
      return "Generate a wild, experimental app idea that pushes technological boundaries.";
    case 3:
      return "Generate a bizarre, over-the-top app idea that defies conventional thinking.";
    default:
      return "Generate a creative and imaginative app idea that offers a unique solution.";
  }
};

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 });
  }
  const vibe = body?.vibe ?? 1;
  if (!Number.isInteger(vibe) || vibe < 0 || vibe > 3) {
    return NextResponse.json({ error: 'Choose a creativity level from 0 to 3.' }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'The generator is temporarily unavailable.' }, { status: 503 });
  }
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 20_000,
      maxRetries: 0,
    });
    const completion = await openai.responses.create({
      model: 'gpt-5.6-luna',
      reasoning: { effort: 'none' },
      max_output_tokens: 100,
      store: false,
      instructions: `You generate short app ideas. ${getVibePrompt(vibe)} Return exactly one idea as type|purpose, for example fitness|helps you track daily workouts. The type must be one word, and the purpose must start with a verb. Use British spelling and Oxford commas. Keep the purpose under 20 words. Do not add other text or formatting.`,
      input: 'Generate an app idea.',
    });
    const parts = completion.output_text?.trim().split('|');
    if (completion.status !== 'completed' || parts?.length !== 2 || !parts.every(part => part.trim())) {
      return NextResponse.json({ error: 'The generator returned an incomplete idea. Please try again.' }, { status: 502 });
    }
    return NextResponse.json({ type: parts[0].trim(), purpose: parts[1].trim() });
  } catch (error) {
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    console.error('Idea generation failed', { status });
    const timedOut = error instanceof OpenAI.APIConnectionTimeoutError;
    return NextResponse.json({ error: timedOut
      ? 'Generation took too long. Please try again.'
      : status === 429
        ? 'The AI service is busy or its quota has been reached. Please try again later.'
        : 'Failed to generate an app idea. Please try again.'
    }, { status: timedOut ? 504 : status === 429 ? 429 : 502 });
  }
}
