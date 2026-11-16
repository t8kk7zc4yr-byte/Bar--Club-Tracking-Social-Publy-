/**
 * Zentrale App-Konfiguration. Der Name ist vorläufig; bei einer Umbenennung
 * genügt es, diese Datei sowie APP_NAME in vite.config.ts und <title> in index.html anzupassen.
 */
export const APP = {
  name: 'Social Publy',
  /** Präfix des Freundescodes, z. B. SP-4F7K2Q (muss zum Präfix in der Datenbank passen) */
  friendCodePrefix: 'SP',
  minAge: 18,
  /** Auswahl für „Bin unterwegs“ in Stunden */
  goingOutHours: [2, 3, 4, 6],
  /** Bestätigungssatz für die Kontolöschung (Groß- und Kleinschreibung egal) */
  deletePhrase: 'Jetzt unwiderruflich Löschen'
} as const;
