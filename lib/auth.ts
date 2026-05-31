import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

export interface AuthUser {
  id: string;
  walletAddress: string;
  email?: string;
  username?: string;
}

export async function createSession(user: AuthUser): Promise<string> {
  const token = await new SignJWT({
    id: user.id,
    walletAddress: user.walletAddress,
    email: user.email,
    username: user.username,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return token;
}

export async function verifySession(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      walletAddress: payload.walletAddress as string,
      email: payload.email as string | undefined,
      username: payload.username as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('session')?.value;

  if (!token) return null;

  return verifySession(token);
}

export async function auth(): Promise<AuthUser | null> {
  return getSession();
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function getOrCreateUser(walletAddressRaw: string): Promise<AuthUser> {
  const walletAddress = walletAddressRaw.toLowerCase();
  let user = await prisma.user.findUnique({
    where: { walletAddress },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        walletAddress,
        username: `user_${walletAddress.slice(0, 8)}`,
      },
    });

    // Create storage balance record
    await prisma.storageBalance.create({
      data: {
        userId: user.id,
        totalBytes: 0,
        walletBalance: 0,
      },
    });
  }

  return {
    id: user.id,
    walletAddress: user.walletAddress,
    email: user.email || undefined,
    username: user.username || undefined,
  };
}

export async function setSessionCookie(token: string) {
  cookies().set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSessionCookie() {
  cookies().delete('session');
}
