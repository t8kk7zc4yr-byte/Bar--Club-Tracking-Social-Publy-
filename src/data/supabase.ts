import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false, solange .env.local nicht ausgefüllt ist; die App zeigt dann einen Hinweis statt abzustürzen */
export const isConfigured = Boolean(url && anonKey);

/**
 * Links aus Bestätigungs- und Passwort-Mails hängen ihre Angaben an die Adresse an (#access_token=…).
 * Weil die App selbst mit #/pfad navigiert, werden diese Angaben hier einmalig ausgelesen und
 * sofort aus der Adresszeile entfernt, bevor die Navigation startet.
 */
export interface AuthLink {
  accessToken?: string;
  refreshToken?: string;
  type?: string;
  error?: string;
}

function readAuthLink(): AuthLink | null {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!/(^|&)(access_token|error|error_code)=/.test(raw)) return null;
  const p = new URLSearchParams(raw);
  history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
  return {
    accessToken: p.get('access_token') ?? undefined,
    refreshToken: p.get('refresh_token') ?? undefined,
    type: p.get('type') ?? undefined,
    error: p.get('error_description') ?? p.get('error') ?? undefined
  };
}

export const authLink = readAuthLink();

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

/** Adresse der App ohne Navigationsteil, als Rücksprungziel für Mails */
export const appUrl = () => window.location.origin + window.location.pathname;
