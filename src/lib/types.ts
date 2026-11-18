import type { CategoryId, TagId } from './tags';

/** Gemeinsamer Katalogeintrag (für alle angemeldeten Nutzer sichtbar) */
export interface Venue {
  id: string;
  name: string;
  category: CategoryId;
  city: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** z. B. "node/123456"; verhindert Dubletten bei Übernahme aus OpenStreetMap */
  osmId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Persönliche Sicht eines Nutzers auf eine Location */
export interface UserVenue {
  userId: string;
  venueId: string;
  /** Gesamtbewertung 1–10, null = unbewertet */
  rating: number | null;
  review?: string | null;
  tags: TagId[];
  /** 1–4 (€ bis €€€€) */
  priceLevel?: number | null;
  foodNote?: string | null;
  favorite: boolean;
  wishlist: boolean;
  coverPhotoId?: string | null;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Drink {
  name: string;
  count: number;
}

export interface Visit {
  id: string;
  userId: string;
  venueId: string;
  /** ISO-Zeitpunkt */
  visitedAt: string;
  /** Bewertung dieses Besuchs 1–10 */
  rating?: number | null;
  note?: string | null;
  /** privat, für Freunde nie sichtbar */
  drinks: Drink[];
  /** Ausgaben in Euro; privat */
  spend?: number | null;
  /** Begleitung ohne Konto als Freitext; privat */
  companionsText: string[];
  tourId?: string | null;
  /** markierte Freunde; sichtbar wird die Markierung erst nach deren Bestätigung */
  tagged?: { userId: string; status: CompanionStatus }[];
  updatedAt: string;
  deletedAt?: string | null;
}

export type CompanionStatus = 'pending' | 'accepted' | 'declined';

export interface VisitCompanion {
  visitId: string;
  userId: string;
  status: CompanionStatus;
}

export interface Photo {
  id: string;
  userId: string;
  venueId: string;
  visitId?: string | null;
  storagePath: string;
  /** Freigabe für Freunde, Standard: aus */
  shared: boolean;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Tour {
  id: string;
  ownerId: string;
  name: string;
  /** Abend der Tour (lokales Datum, JJJJ-MM-TT) */
  day: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  displayName: string;
  friendCode: string;
  avatarColor: string;
  shareWithFriends: boolean;
  adultConfirmedAt: string | null;
  goingOutUntil?: string | null;
  goingOutPlace?: string | null;
  monthlySpendLimit?: number | null;
}

export type FriendStatus = 'accepted' | 'pending_in' | 'pending_out';

export interface Friend {
  id: string;
  displayName: string;
  avatarColor: string;
  status: FriendStatus;
  notifyEntries: boolean;
  notifyGoingOut: boolean;
  goingOutUntil?: string | null;
  goingOutPlace?: string | null;
}

export type ActivityType = 'checkin' | 'going_out' | 'new_venue' | 'rating' | 'photo' | 'tour';

export interface Activity {
  id: string;
  actorId: string;
  type: ActivityType;
  photoId?: string | null;
  tourId?: string | null;
  venueId?: string | null;
  venueName?: string | null;
  city?: string | null;
  rating?: number | null;
  createdAt: string;
}

export type ThemeMode = 'system' | 'light' | 'dark';

/** Einstellungen, die nur auf dem Gerät liegen */
export interface DeviceSettings {
  theme: ThemeMode;
  pushSubscribed: boolean;
  feedSeenAt?: string;
}
