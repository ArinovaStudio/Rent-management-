import { SignJWT, jwtVerify } from "jose";

export type Role = "SUPER_ADMIN" | "PROPERTY_ADMIN" | "PROPERTY_MANAGER";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);

// `name` rides in the token so pages can show it without a database lookup
export async function signAccessToken(userId: string, role: Role, name?: string) {
  return new SignJWT({ role, ...(name ? { name } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
}

export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: payload.sub as string, role: payload.role as Role, name: typeof payload.name === "string" ? payload.name : undefined };
  } catch {
    return null;
  }
}
