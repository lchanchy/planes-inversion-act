export function bearerToken(authorization: string | null): string | null {
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}
