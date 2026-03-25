import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

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
    if (!storedScreenshot) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SCREENSHOT_NOT_FOUND',
            message: 'No screenshot found for analysis ID',
            retryable: false,
          },
        },
        {
          status: 404,
          headers: {
            'X-Analysis-Id': id,
          },
        }
      );
    }

    return new NextResponse(decodePngBytes(storedScreenshot), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
        'X-Analysis-Id': id,
      },
    });
  } catch (error) {
    console.error('Screenshot KV read error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'KV_READ_ERROR',
          message: 'Failed to retrieve screenshot',
          retryable: true,
        },
      },
      { status: 503 }
    );
  }
}
