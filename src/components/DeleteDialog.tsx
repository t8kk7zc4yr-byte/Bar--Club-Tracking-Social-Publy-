import { useState } from 'react';
import { Link } from 'react-router-dom';
import { APP } from '../config/app';
import { deleteMyAccount } from '../data/account';
import { toast } from '../lib/notify';

/** Groß- und Kleinschreibung sowie Leerzeichen am Rand werden beim Vergleich ignoriert */
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');

/** Bestätigungsdialog für die unwiderrufliche Löschung des Kontos mit allen Daten */
export default function DeleteDialog({ onClose, onExport }: { onClose: () => void; onExport: () => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const armed = normalize(text) === normalize(APP.deletePhrase);

  const run = async () => {
    setBusy(true);
    try {
      await deleteMyAccount();
      toast('Dein Konto und alle Daten wurden unwiderruflich gelöscht');
    } catch (e) {
      toast(`Löschung fehlgeschlagen: ${(e as Error).message}. Bitte mit Internetverbindung erneut versuchen.`);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="del-title" style={{ marginTop: 0 }}>🗑️ Konto und alle Daten löschen</h2>

        <div className="warnbox" role="alert">
          <b>Das kann nicht rückgängig gemacht werden.</b> Es gibt keinen Papierkorb und keine Sicherungskopie, auf die wir zurückgreifen könnten.
        </div>

        <div className="small" style={{ lineHeight: 1.55 }}>
          <b>Gelöscht werden:</b> dein Konto mit E-Mail-Adresse und Freundescode, alle Besuche mit Bewertungen, Getränken, Ausgaben, Begleitung und Notizen,
          deine Angaben zu Locations, Favoriten und Wunschliste, alle Fotos, Freundschaften, Markierungen, Touren, dein Unterwegs-Status
          und deine Feed-Einträge, auf dem Server und auf diesem Gerät.
        </div>
        <div className="small muted mt8" style={{ lineHeight: 1.55 }}>
          <b>Bestehen bleiben:</b> Locations, die du im gemeinsamen Katalog angelegt hast (Name, Art, Adresse), ohne Verweis auf dich;
          Markierungen von dir in Besuchen deiner Freunde werden mit gelöscht. Nicht erfasst sind Dateien, die du selbst exportiert hast.
          Details in den <Link to="/datenschutz" onClick={onClose}>Datenschutzhinweisen</Link>.
        </div>

        <button className="btn block mt12" disabled={busy} onClick={onExport}>⬇️ Vorher meine Daten exportieren</button>

        <label className="field mt12">
          <span>Zur Bestätigung „{APP.deletePhrase}“ eintippen</span>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder={APP.deletePhrase} disabled={busy} />
        </label>

        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn danger block" disabled={!armed || busy} onClick={run}>{busy ? 'Wird gelöscht …' : 'Endgültig und unwiderruflich löschen'}</button>
          <button className="btn block" disabled={busy} onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
