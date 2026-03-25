import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function decodePngBytes(pngBase64: string) {
  return Buffer.from(pngBase64.replace(/^data:image\/png;base64,/, ''), 'base64');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MISSING_ID',
          message: "Query parameter 'id' is required",
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  try {
    const storedScreenshot = await kv.get<string>(`screenshot:${id}`);
    const pngBase64 = storedScreenshot || PLACEHOLDER_PNG_BASE64;

    return new NextResponse(decodePngBytes(pngBase64), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('Screenshot KV read error:', error);

    return new NextResponse(decodePngBytes(PLACEHOLDER_PNG_BASE64), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
}
