import { SignJWT, jwtVerify } from "jose";

export type Role = "SUPER_ADMIN" | "PROPERTY_ADMIN" | "PROPERTY_MANAGER";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);

export async function signAccessToken(userId: string, role: Role) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
}

export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: payload.sub as string, role: payload.role as Role };
  } catch {
    return null;
  }
}
