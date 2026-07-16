import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export type Session = { playerId: string; name: string; isAdmin: boolean };

const COOKIE = 'session';
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function createSessionToken(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('180d')
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { playerId: payload.playerId as string, name: payload.name as string, isAdmin: !!payload.isAdmin };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 180 * 24 * 3600,
  };
}
export const SESSION_COOKIE = COOKIE;
