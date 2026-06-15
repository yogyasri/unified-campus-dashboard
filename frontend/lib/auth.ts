import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "campus-hub-super-secret-key";
const TOKEN_EXPIRY = "24h";
const COOKIE_NAME = "campus_hub_token";

export interface StudentSession {
  studentId: string;
  name: string;
  email: string;
  major: string;
  year: number;
}

/**
 * Sign a JWT token with student data
 */
export function signToken(payload: StudentSession): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): StudentSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as StudentSession;
  } catch {
    return null;
  }
}

/**
 * Hash a password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare a password against a bcrypt hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Get the current session from cookies (for use in Server Components / Route Handlers)
 */
export async function getSession(): Promise<StudentSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Cookie name constant for setting/clearing
 */
export { COOKIE_NAME };
