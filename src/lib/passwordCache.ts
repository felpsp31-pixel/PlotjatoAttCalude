/**
 * Cache de validação de senha por sessão (8h).
 * Evita chamadas repetidas à edge function `validate-password` quando o usuário
 * já validou a mesma senha recentemente no mesmo módulo.
 *
 * Armazena apenas um hash SHA-256 da senha (não a senha em claro) + timestamp.
 */
const TTL_MS = 8 * 60 * 60 * 1000; // 8h
const PREFIX = 'pwcache:';

type CacheEntry = { hash: string; ts: number };

const sha256 = async (text: string): Promise<string> => {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const readEntry = (type: string): CacheEntry | null => {
  try {
    const raw = sessionStorage.getItem(PREFIX + type);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.ts > TTL_MS) {
      sessionStorage.removeItem(PREFIX + type);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/** Retorna true se a senha bate com o hash em cache para esse tipo. */
export const isPasswordCached = async (type: string, password: string): Promise<boolean> => {
  const entry = readEntry(type);
  if (!entry) return false;
  const hash = await sha256(password);
  return hash === entry.hash;
};

/** Salva o hash da senha validada para reuso na sessão. */
export const cachePassword = async (type: string, password: string): Promise<void> => {
  try {
    const hash = await sha256(password);
    sessionStorage.setItem(
      PREFIX + type,
      JSON.stringify({ hash, ts: Date.now() } satisfies CacheEntry),
    );
  } catch { /* ignore */ }
};

/** Limpa todo o cache de senhas (usar no logout). */
export const clearPasswordCache = (): void => {
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
};
