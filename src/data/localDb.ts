import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Photo, UserVenue, Venue, Visit } from '../lib/types';

/** Eine ausstehende Änderung, die noch an den Server gesendet werden muss */
export type OutboxOp =
  | { kind: 'venue'; id: string }
  | { kind: 'userVenue'; venueId: string }
  | { kind: 'userVenueDelete'; venueId: string }
  | { kind: 'visit'; id: string }
  | { kind: 'visitDelete'; id: string }
  | { kind: 'photo'; id: string }
  | { kind: 'photoDelete'; id: string; storagePath: string };

export interface OutboxEntry {
  seq?: number;
  op: OutboxOp;
  attempts: number;
}

interface AppDB extends DBSchema {
  venues: { key: string; value: Venue };
  userVenues: { key: string; value: UserVenue };
  visits: { key: string; value: Visit };
  photos: { key: string; value: Photo };
  /** Bilddateien: noch nicht hochgeladene Fotos und Zwischenspeicher */
  blobs: { key: string; value: Blob };
  outbox: { key: number; value: OutboxEntry };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

export function db() {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>('social-publy', 1, {
      upgrade(d) {
        d.createObjectStore('venues', { keyPath: 'id' });
        d.createObjectStore('userVenues', { keyPath: 'venueId' });
        d.createObjectStore('visits', { keyPath: 'id' });
        d.createObjectStore('photos', { keyPath: 'id' });
        d.createObjectStore('blobs');
        d.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
        d.createObjectStore('meta');
      }
    });
  }
  return dbPromise;
}

const DATA_STORES = ['venues', 'userVenues', 'visits', 'photos', 'blobs', 'outbox', 'meta'] as const;

/** Entfernt alle lokalen Daten (Abmeldung oder Kontowechsel) */
export async function clearLocal() {
  const d = await db();
  const tx = d.transaction([...DATA_STORES], 'readwrite');
  await Promise.all([...DATA_STORES.map((s) => tx.objectStore(s).clear()), tx.done]);
}
