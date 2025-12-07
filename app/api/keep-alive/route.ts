import { NextResponse } from 'next/server';

/**
 * Keep-alive endpoint to prevent the app from spinning down due to inactivity
 * This endpoint can be called periodically (e.g., via Vercel Cron) to keep the serverless functions warm
 */
export async function GET() {
  // Simple health check response
  // This endpoint doesn't do anything heavy, just confirms the app is alive
  return NextResponse.json(
    { 
      status: 'ok', 
      message: 'App is alive',
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}

