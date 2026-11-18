import { useSyncExternalStore } from 'react';
import type { User } from '@supabase/supabase-js';
import { APP } from '../config/app';
import type { Profile } from '../lib/types';
import { appUrl, authLink, supabase } from './supabase';

export type SessionStatus = 'loading' | 'out' | 'in' | 'recovery';

export interface SessionState {
  status: SessionStatus;
  user: User | null;
  profile: Profile | null;
  /** Hinweis aus einem Mail-Link, z. B. „E-Mail bestätigt“ oder ein abgelaufener Link */
  notice: string | null;
}

let state: SessionState = { status: 'loading', user: null, profile: null, notice: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<SessionState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useSession<T>(selector: (s: SessionState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state)
  );
}
export const getSession = () => state;
export const clearNotice = () => set({ notice: null });

interface ProfileRow {
  id: string;
  display_name: string;
  friend_code: string;
  avatar_color: string;
  share_with_friends: boolean;
  adult_confirmed_at: string | null;
}

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  friendCode: r.friend_code,
  avatarColor: r.avatar_color,
  shareWithFriends: r.share_with_friends,
  adultConfirmedAt: r.adult_confirmed_at
});

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, friend_code, avatar_color, share_with_friends, adult_confirmed_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const profile = toProfile(data as ProfileRow);
  const { data: st } = await supabase.from('user_settings').select('monthly_spend_limit').eq('user_id', userId).maybeSingle();
  return { ...profile, monthlySpendLimit: st?.monthly_spend_limit === null || st?.monthly_spend_limit === undefined ? null : Number(st.monthly_spend_limit) };
}

async function enter(user: User, status: SessionStatus = 'in') {
  const profile = await loadProfile(user.id);
  set({ status, user, profile });
}

/** Übersetzt die häufigsten Meldungen des Anmeldedienstes */
export function authMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  const code = (e as { code?: string })?.code ?? '';
  if (/Invalid login credentials/i.test(msg)) return 'E-Mail oder Passwort stimmt nicht.';
  if (/Email not confirmed/i.test(msg)) return 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Mail.';
  if (/already registered|already been registered/i.test(msg)) return 'Zu dieser E-Mail-Adresse gibt es bereits ein Konto.';
  if (/Database error saving new user/i.test(msg)) return 'Registrierung nicht möglich: Der Einladungscode ist ungültig oder aufgebraucht.';
  if (/rate limit|too many/i.test(msg) || code === 'over_email_send_rate_limit')
    return 'Zu viele Versuche in kurzer Zeit. Bitte später erneut versuchen.';
  if (/Password should be|weak/i.test(msg)) return 'Das Passwort ist zu schwach. Bitte mindestens 8 Zeichen wählen.';
  if (/valid email|invalid format/i.test(msg)) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  if (/expired|invalid.*link|otp/i.test(msg)) return 'Der Link ist abgelaufen oder wurde schon benutzt. Bitte fordere einen neuen an.';
  if (/fetch|network/i.test(msg)) return 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.';
  if (/different from the old/i.test(msg)) return 'Das neue Passwort muss sich vom alten unterscheiden.';
  return msg;
}

export async function initSession() {
  // 1. Rücksprung aus einer Mail (Bestätigung oder Passwort zurücksetzen)
  if (authLink?.error) {
    set({ notice: authMessage({ message: authLink.error }) });
  } else if (authLink?.accessToken && authLink.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: authLink.accessToken,
      refresh_token: authLink.refreshToken
    });
    if (!error && data.user) {
      if (authLink.type === 'recovery') {
        await enter(data.user, 'recovery');
      } else {
        set({ notice: 'E-Mail-Adresse bestätigt. Willkommen!' });
        await enter(data.user);
      }
      watch();
      return;
    }
    set({ notice: authMessage(error) });
  }

  // 2. Gespeicherte Sitzung
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) await enter(data.session.user);
  else set({ status: 'out', user: null, profile: null });
  watch();
}

let watching = false;
function watch() {
  if (watching) return;
  watching = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') set({ status: 'out', user: null, profile: null });
    if (event === 'TOKEN_REFRESHED' && session?.user) set({ user: session.user });
  });
}

export async function checkInvite(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_invite', { p_code: code });
  if (error) throw error;
  return data === true;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  inviteCode: string;
  shareWithFriends: boolean;
}

/**
 * Registriert ein Konto. Die Volljährigkeit wurde vorher im Formular anhand des Geburtsdatums geprüft;
 * übertragen wird nur die Bestätigung, nicht das Datum.
 * Rückgabe 'confirm': Bestätigungs-Mail wurde versendet. 'in': direkt angemeldet.
 */
export async function signUp(input: SignUpInput): Promise<'confirm' | 'in'> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: appUrl(),
      data: {
        display_name: input.displayName.trim(),
        invite_code: input.inviteCode.trim().toUpperCase(),
        adult_confirmed: true,
        share_with_friends: input.shareWithFriends
      }
    }
  });
  if (error) throw error;
  if (data.session?.user) {
    await enter(data.session.user);
    await applyPendingShare();
    return 'in';
  }
  return 'confirm';
}

/** Die im Formular gewählte Teilen-Einstellung wird beim ersten Betreten ins Profil übernommen */
async function applyPendingShare() {
  const { user, profile } = state;
  if (!user || !profile) return;
  const wanted = user.user_metadata?.share_with_friends;
  if (wanted === true && !profile.shareWithFriends) await updateProfile({ shareWithFriends: true });
  if (wanted !== undefined) await supabase.auth.updateUser({ data: { share_with_friends: null, invite_code: null } });
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  await enter(data.user);
  await applyPendingShare();
}

export async function signOut() {
  await supabase.auth.signOut();
  set({ status: 'out', user: null, profile: null });
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
  if (error) throw error;
}

export async function setNewPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  set({ status: 'in' });
}

export async function updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'shareWithFriends' | 'avatarColor'>>) {
  const { profile } = state;
  if (!profile) return;
  const row: Record<string, unknown> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim().slice(0, 40) || 'Ich';
  if (patch.shareWithFriends !== undefined) row.share_with_friends = patch.shareWithFriends;
  if (patch.avatarColor !== undefined) row.avatar_color = patch.avatarColor;
  const { data, error } = await supabase
    .from('profiles')
    .update(row)
    .eq('id', profile.id)
    .select('id, display_name, friend_code, avatar_color, share_with_friends, adult_confirmed_at')
    .single();
  if (error) throw error;
  set({ profile: { ...toProfile(data as ProfileRow), monthlySpendLimit: profile.monthlySpendLimit ?? null } });
}

/** Monatliches Ausgehbudget in Euro; null entfernt es */
export async function updateBudget(limit: number | null) {
  const { profile } = state;
  if (!profile) return;
  const { error } = await supabase.from('user_settings').upsert({ user_id: profile.id, monthly_spend_limit: limit }, { onConflict: 'user_id' });
  if (error) throw error;
  set({ profile: { ...profile, monthlySpendLimit: limit } });
}

export const MIN_PASSWORD = 8;
export const friendCodeHint = `${APP.friendCodePrefix}-XXXXXX`;
