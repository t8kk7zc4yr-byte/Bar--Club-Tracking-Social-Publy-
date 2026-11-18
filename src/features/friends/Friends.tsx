import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Empty, Header, RatingBadge, Toggle } from '../../components/ui';
import { APP } from '../../config/app';
import { useSession } from '../../data/session';
import {
  acceptFriend, answerCompanion, fetchVenue, joinTour, markFeedSeen, refreshSocial, removeCompanionTag, removeFriend, requestFriend,
  setFriendNotify, setGoingOut, sharedPhotoUrl, useSocial, type CompanionRequest
} from '../../data/social';
import { adoptVenue } from '../../data/store';
import { toast } from '../../lib/notify';
import type { Activity, Friend } from '../../lib/types';
import { fmtDate, relTime } from '../../lib/util';
import FriendTips from './FriendTips';

const time = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

function feedText(a: Activity, name: string): { title: string; body: string } {
  const where = [a.venueName, a.city].filter(Boolean).join(' · ');
  switch (a.type) {
    case 'checkin': return { title: `${name} ist eingecheckt`, body: where };
    case 'new_venue': return { title: `${name} war zum ersten Mal hier`, body: where };
    case 'rating': return { title: `${name} hat bewertet`, body: where };
    case 'photo': return { title: `${name} hat ein Foto geteilt`, body: where };
    case 'going_out': return { title: `${name} ist unterwegs`, body: a.venueName ?? '' };
    case 'tour': return { title: `${name} startet eine Tour`, body: a.venueName ?? '' };
  }
}

function SharedPhoto({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    sharedPhotoUrl(id).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [id]);
  if (!url) return null;
  return <img src={url} alt="Geteiltes Foto" loading="lazy" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginTop: 8 }} />;
}

export default function Friends() {
  const nav = useNavigate();
  const profile = useSession((s) => s.profile);
  const uid = useSession((s) => s.user?.id);
  const friends = useSocial((s) => s.friends);
  const feed = useSocial((s) => s.feed);
  const requests = useSocial((s) => s.requests);
  const goingOutUntil = useSocial((s) => s.goingOutUntil);
  const goingOutPlace = useSocial((s) => s.goingOutPlace);
  const seenAt = useSocial((s) => s.seenAt);
  const error = useSocial((s) => s.error);
  const loaded = useSocial((s) => s.loaded);
  const tours = useSocial((s) => s.tours);
  const [seenBefore] = useState(seenAt);
  const [code, setCode] = useState('');
  const [place, setPlace] = useState('');
  const [hours, setHours] = useState<number>(4);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshSocial();
    const t = window.setInterval(() => void refreshSocial(), 60000);
    // Feed als gelesen markieren, sobald man die Seite verlässt
    return () => {
      clearInterval(t);
      markFeedSeen();
    };
  }, []);

  if (!profile) return null;
  const sharing = profile.shareWithFriends;
  const accepted = friends.filter((f) => f.status === 'accepted');
  const incoming = friends.filter((f) => f.status === 'pending_in');
  const outgoing = friends.filter((f) => f.status === 'pending_out');
  const byId = new Map(friends.map((f) => [f.id, f]));
  const live = accepted.filter((f) => f.goingOutUntil);
  const openRequests = requests.filter((r) => r.status === 'pending');
  const others = feed.filter((a) => a.actorId !== uid);
  const isOut = !!goingOutUntil && new Date(goingOutUntil).getTime() > Date.now();

  const guard = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const msg = (e as Error).message || '';
      toast(/fetch|network/i.test(msg) ? 'Keine Verbindung zum Server' : msg || 'Das hat nicht geklappt');
    } finally {
      setBusy(false);
    }
  };

  const goOut = (on: boolean) =>
    guard(async () => {
      if (on) {
        await setGoingOut(hours, place);
        toast(`🍻 Deine Freunde sehen jetzt, dass du unterwegs bist (${hours} Std.)`);
        setPlace('');
      } else await setGoingOut(null);
    });

  const addFriend = () =>
    guard(async () => {
      const c = code.trim().toUpperCase();
      if (!new RegExp(`^${APP.friendCodePrefix}-[A-Z0-9]{6}$`).test(c)) return toast(`Ungültiger Code. Format: ${APP.friendCodePrefix}-XXXXXX`);
      const name = await requestFriend(c);
      toast(`Anfrage an ${name} gesendet`);
      setCode('');
    });

  const remove = (f: Friend, question: string) => confirm(question) && guard(() => removeFriend(f.id));

  const shareCode = async () => {
    const text = `Lass uns auf ${APP.name} vernetzen! Mein Code: ${profile.friendCode}\n${location.origin}${location.pathname}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(profile.friendCode);
        toast('Code kopiert');
      }
    } catch {
      /* abgebrochen */
    }
  };

  const confirmTag = (r: CompanionRequest, alsoMine: boolean) =>
    guard(async () => {
      await answerCompanion(r.visitId, 'accepted');
      if (!alsoMine) return toast('Markierung bestätigt');
      const venue = await fetchVenue(r.venueId);
      if (!venue) return toast('Location nicht gefunden');
      await adoptVenue(venue, null);
      nav(`/checkin?venue=${venue.id}&when=${encodeURIComponent(r.visitedAt)}&with=${r.ownerId}`);
    });

  return (
    <div className="page">
      <Header title="Freunde" sub={`${accepted.length} vernetzt`} />

      {error && <div className="warnbox" role="alert">Freunde konnten nicht geladen werden. Bitte später erneut versuchen.</div>}

      {!sharing && (
        <div className="notice">
          Teilen ist ausgeschaltet: Freunde sehen deine Check-ins und deinen Unterwegs-Status nicht. Einschalten kannst du es im{' '}
          <button className="link-btn" onClick={() => nav('/profil')}>Profil</button>.
        </div>
      )}

      <div className={`card ${isOut ? 'going-out' : ''}`}>
        <div className="switch" style={{ paddingTop: 0 }}>
          <div>
            <div className="t">{isOut ? <span className="live">Du bist unterwegs</span> : '🍻 Ich bin unterwegs'}</div>
            <div className="s">
              {isOut
                ? `${goingOutPlace ? goingOutPlace + ' · ' : ''}endet um ${time(goingOutUntil!)} Uhr automatisch`
                : 'Freunde sehen deinen Status. Nur manuell, keine Standortverfolgung.'}
            </div>
          </div>
          <Toggle label="Ich bin unterwegs" checked={isOut} onChange={(on) => (sharing || !on ? goOut(on) : toast('Schalte zuerst im Profil „Mit Freunden teilen“ ein'))} />
        </div>
        {!isOut && (
          <div className="row">
            <input className="input" placeholder="Wo? (optional)" maxLength={80} value={place} onChange={(e) => setPlace(e.target.value)} />
            <select className="input" style={{ flex: 'none', width: 96 }} value={hours} onChange={(e) => setHours(+e.target.value)} aria-label="Dauer">
              {APP.goingOutHours.map((h) => <option key={h} value={h}>{h} Std.</option>)}
            </select>
          </div>
        )}
      </div>

      {incoming.length > 0 && (
        <div className="section">
          <div className="section-h"><h2>📨 Anfragen</h2></div>
          {incoming.map((f) => (
            <div className="card flex" key={f.id}>
              <Avatar name={f.displayName} color={f.avatarColor} size="sm" />
              <div className="grow"><b>{f.displayName}</b><div className="small muted">möchte sich mit dir vernetzen</div></div>
              <button className="btn sm primary" disabled={busy} onClick={() => guard(async () => { await acceptFriend(f.id); toast(`Du bist jetzt mit ${f.displayName} vernetzt 🎉`); })}>Annehmen</button>
              <button className="btn sm" disabled={busy} onClick={() => guard(() => removeFriend(f.id))} aria-label={`Anfrage von ${f.displayName} ablehnen`}>✕</button>
            </div>
          ))}
        </div>
      )}

      {openRequests.length > 0 && (
        <div className="section">
          <div className="section-h"><h2>🏷️ Du wurdest markiert</h2></div>
          {openRequests.map((r) => (
            <div className="card" key={r.visitId}>
              <div><b>{r.ownerName}</b> hat dich als Begleitung eingetragen:</div>
              <div className="small muted mt8">{r.venueName}{r.city ? ` · ${r.city}` : ''} · {fmtDate(r.visitedAt, true)}</div>
              <div className="small muted mt8">Erst nach deiner Bestätigung ist die Markierung für andere sichtbar.</div>
              <div className="btn-row mt12">
                <button className="btn sm primary" disabled={busy} onClick={() => confirmTag(r, true)}>Bestätigen und bei mir eintragen</button>
                <button className="btn sm" disabled={busy} onClick={() => confirmTag(r, false)}>Nur bestätigen</button>
                <button className="btn sm danger" disabled={busy} onClick={() => guard(() => removeCompanionTag(r.visitId))}>Ablehnen</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {live.length > 0 && (
        <div className="section">
          <div className="section-h"><h2>🟢 Gerade unterwegs</h2></div>
          <div className="hscroll">
            {live.map((f) => (
              <div key={f.id} className="card" style={{ flex: 'none', width: 150, textAlign: 'center' }}>
                <div style={{ display: 'grid', placeItems: 'center' }}><Avatar name={f.displayName} color={f.avatarColor} /></div>
                <div style={{ fontWeight: 650, marginTop: 6 }}>{f.displayName}</div>
                <div className="small muted">{f.goingOutPlace ?? 'unterwegs'}</div>
                <div className="small muted">bis {time(f.goingOutUntil!)} Uhr</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tours.some((t) => t.ownerId !== uid && t.day >= new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)) && (
        <div className="section">
          <div className="section-h"><h2>🚶 Touren deiner Freunde</h2></div>
          {tours
            .filter((t) => t.ownerId !== uid && t.day >= new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10))
            .map((t) => (
              <div className="card flex" key={t.id} style={{ marginBottom: 8 }}>
                <div className="grow" style={{ cursor: 'pointer' }} onClick={() => nav(`/tour/${t.id}`)}>
                  <b>{t.name}</b>
                  <div className="small muted">von {t.ownerName} · {t.members} {t.members === 1 ? 'Person' : 'Personen'}</div>
                </div>
                {t.joined ? (
                  <button className="btn sm" onClick={() => nav(`/tour/${t.id}`)}>Ansehen</button>
                ) : (
                  <button className="btn sm primary" disabled={busy} onClick={() => guard(async () => { await joinTour(t); toast(`Du bist bei „${t.name}“ dabei`); })}>Beitreten</button>
                )}
              </div>
            ))}
        </div>
      )}

      <FriendTips />

      <div className="section">
        <div className="section-h">
          <h2>📰 Aktivitäten</h2>
          <button className="link" onClick={() => guard(refreshSocial)}>Aktualisieren</button>
        </div>
        {others.length ? (
          <div className="card" style={{ padding: '0 14px' }}>
            {others.slice(0, 40).map((a) => {
              const f = byId.get(a.actorId);
              const t = feedText(a, f?.displayName ?? 'Jemand');
              return (
                <div className="feed-item" key={a.id}>
                  <Avatar name={f?.displayName ?? '?'} color={f?.avatarColor ?? '#888888'} size="sm" />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div className="small muted">{[t.body, relTime(a.createdAt)].filter(Boolean).join(' · ')}</div>
                    {a.type === 'photo' && a.photoId && <SharedPhoto id={a.photoId} />}
                    {a.type === 'tour' && a.tourId && <button className="link" onClick={() => nav(`/tour/${a.tourId}`)}>Tour ansehen</button>}
                  </div>
                  {typeof a.rating === 'number' && <RatingBadge value={a.rating} size="sm" />}
                  {a.createdAt > seenBefore && <span className="unread" aria-label="neu" />}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty emoji="👥" title={loaded ? 'Noch keine Aktivitäten' : 'Lädt …'}>
            {accepted.length ? 'Sobald deine Freunde einchecken und das Teilen aktiviert haben, erscheint es hier.' : 'Vernetze dich per Code mit Freunden, um ihre Check-ins zu sehen.'}
          </Empty>
        )}
      </div>

      <div className="section">
        <div className="section-h"><h2>👥 Deine Freunde</h2></div>
        {accepted.map((f) => (
          <div className="card" key={f.id} style={{ padding: '10px 14px' }}>
            <button className="flex" aria-expanded={open === f.id} style={{ background: 'none', border: 0, padding: 0, width: '100%', textAlign: 'left' }} onClick={() => setOpen(open === f.id ? null : f.id)}>
              <Avatar name={f.displayName} color={f.avatarColor} size="sm" />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{f.displayName}</div>
                <div className="small muted">
                  {f.notifyEntries || f.notifyGoingOut ? '🔔 ' : '🔕 '}
                  {[f.notifyEntries && 'Einträge', f.notifyGoingOut && 'Unterwegs'].filter(Boolean).join(' & ') || 'stumm'}
                </div>
              </div>
              <span className="muted">{open === f.id ? '▴' : '▾'}</span>
            </button>
            {open === f.id && (
              <div className="mt8">
                <div className="small muted">Benachrichtigungen (wirksam, sobald Push eingerichtet ist)</div>
                <div className="switch">
                  <div><div className="t">Neue Einträge</div><div className="s">Check-ins, Bewertungen, Fotos</div></div>
                  <Toggle label="Neue Einträge" checked={f.notifyEntries} onChange={(x) => guard(() => setFriendNotify(f.id, { notifyEntries: x }))} />
                </div>
                <div className="switch">
                  <div><div className="t">Ist unterwegs</div><div className="s">Wenn {f.displayName} den Abend startet</div></div>
                  <Toggle label="Ist unterwegs" checked={f.notifyGoingOut} onChange={(x) => guard(() => setFriendNotify(f.id, { notifyGoingOut: x }))} />
                </div>
                <button className="btn sm danger mt8" onClick={() => remove(f, `Freundschaft mit ${f.displayName} beenden?`)}>Entfernen</button>
              </div>
            )}
          </div>
        ))}
        {outgoing.map((f) => (
          <div className="card flex" key={f.id} style={{ padding: '10px 14px' }}>
            <Avatar name={f.displayName} color={f.avatarColor} size="sm" />
            <div className="grow"><b>{f.displayName}</b><div className="small muted">Anfrage gesendet, wartet auf Bestätigung</div></div>
            <button className="btn sm" onClick={() => remove(f, `Anfrage an ${f.displayName} zurückziehen?`)} aria-label="Anfrage zurückziehen">✕</button>
          </div>
        ))}

        <div className="card mt12">
          <div className="small muted">Dein Freundescode</div>
          <div className="flex between">
            <div className="code-box">{profile.friendCode}</div>
            <button className="btn sm" onClick={shareCode}>Teilen</button>
          </div>
          <div className="small muted mt12">Freund per Code hinzufügen</div>
          <form
            className="row mt8"
            onSubmit={(e) => {
              e.preventDefault();
              addFriend();
            }}
          >
            <input className="input" placeholder={`${APP.friendCodePrefix}-XXXXXX`} aria-label="Freundescode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" />
            <button className="btn" style={{ flex: 'none' }} disabled={busy || !code.trim()}>Anfrage senden</button>
          </form>
        </div>
      </div>
    </div>
  );
}
