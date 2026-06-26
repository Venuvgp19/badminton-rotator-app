import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Redis from 'ioredis';

// Persistent in-memory session state fallback on the server
let sessionStateFallback = null;

const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const hasRedisUrl = !!process.env.REDIS_URL;

let redisClient = null;
if (hasRedisUrl && !hasKV) {
  try {
    redisClient = new Redis(process.env.REDIS_URL);
    redisClient.on('error', (err) => {
      console.error("Redis connection error:", err);
    });
  } catch (e) {
    console.error("Failed to initialize ioredis client:", e);
  }
}

export async function GET() {
  if (hasKV) {
    try {
      const data = await kv.get('badminton_session_state');
      return NextResponse.json(data || {});
    } catch (e) {
      console.error("Vercel KV GET failed, falling back to memory:", e);
    }
  } else if (redisClient) {
    try {
      const dataStr = await redisClient.get('badminton_session_state');
      return NextResponse.json(dataStr ? JSON.parse(dataStr) : {});
    } catch (e) {
      console.error("Redis URL GET failed, falling back to memory:", e);
    }
  }
  return NextResponse.json(sessionStateFallback || {});
}

export async function POST(request) {
  try {
    const data = await request.json();
    if (hasKV) {
      try {
        await kv.set('badminton_session_state', data);
        return NextResponse.json({ status: 'success', data });
      } catch (e) {
        console.error("Vercel KV SET failed, falling back to memory:", e);
      }
    } else if (redisClient) {
      try {
        await redisClient.set('badminton_session_state', JSON.stringify(data));
        return NextResponse.json({ status: 'success', data });
      } catch (e) {
        console.error("Redis URL SET failed, falling back to memory:", e);
      }
    }
    sessionStateFallback = data;
    return NextResponse.json({ status: 'success', data: sessionStateFallback });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: 400 });
  }
}


