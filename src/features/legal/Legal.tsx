import { APP } from '../../config/app';
import { Header } from '../../components/ui';

/** Solange true, werden die Texte als Entwurf gekennzeichnet. Vor einer Weitergabe an Dritte ausfüllen. */
const IS_DRAFT = true;

export default function Legal({ doc }: { doc: 'datenschutz' | 'impressum' }) {
  return (
    <div className="page no-tabbar legal-body">
      <Header back title={doc === 'datenschutz' ? 'Datenschutzhinweise' : 'Impressum'} />
      {IS_DRAFT && (
        <div className="draft-banner">
          <b>Entwurf für den internen Test.</b> Dieser Text ist noch nicht vollständig und nicht rechtlich geprüft. Angaben in eckigen Klammern fehlen noch.
        </div>
      )}
      {doc === 'datenschutz' ? <Privacy /> : <Imprint />}
    </div>
  );
}

function Privacy() {
  return (
    <>
      <h2>1. Verantwortliche</h2>
      <p>[Namen und Anschrift der Verantwortlichen, Kontakt-E-Mail]</p>

      <h2>2. Welche Daten verarbeitet werden</h2>
      <ul>
        <li>Konto: E-Mail-Adresse, Passwort (nur als Prüfwert gespeichert), Anzeigename, Freundescode, Zeitpunkt der Bestätigung der Volljährigkeit. Das Geburtsdatum wird nur im Formular geprüft und nicht gespeichert.</li>
        <li>Inhalte: besuchte Locations, Zeitpunkte der Besuche, Bewertungen, Tags, Notizen, Getränke, Ausgaben, Begleitung, Fotos.</li>
        <li>Freunde: Freundschaften, Benachrichtigungseinstellungen, der Status „Bin unterwegs“, Markierungen.</li>
        <li>Standort: nur im Moment des Check-ins oder beim Öffnen der Karte, um Locations in der Nähe vorzuschlagen. Es findet keine laufende Ortung statt; ein Bewegungsverlauf wird nicht gespeichert.</li>
      </ul>

      <h2>3. Wer was sehen kann</h2>
      <p>
        Ohne deine Freigabe sieht niemand außer dir deine Einträge. Schaltest du „Mit Freunden teilen“ ein, sehen bestätigte Freunde Location, Zeitpunkt, Bewertung, Tags und Notiz deiner Besuche.
        Getränke, Ausgaben und frei eingetragene Begleitpersonen sind für andere nie sichtbar. Fotos sind privat, bis du ein Foto einzeln freigibst. Eine Markierung als Begleitung wird erst wirksam, wenn die markierte Person zustimmt.
      </p>

      <h2>4. Empfänger und Dienstleister</h2>
      <ul>
        <li>Hosting der Datenbank, Anmeldung und Fotos: Supabase, Serverstandort Frankfurt am Main. [Angaben zum Auftragsverarbeitungsvertrag]</li>
        <li>Auslieferung der App: GitHub Pages. [Angaben ergänzen]</li>
        <li>Karten und Ortssuche: Dienste des OpenStreetMap-Projekts. Beim Laden der Karte und bei der Suche werden IP-Adresse und der angefragte Kartenausschnitt bzw. Suchbegriff übertragen.</li>
      </ul>
      <p>Es werden keine Analyse- oder Werbedienste eingesetzt.</p>

      <h2>5. Rechtsgrundlagen und Speicherdauer</h2>
      <p>[Rechtsgrundlagen nach Art. 6 DSGVO, Speicherdauer, Löschung inaktiver Konten]</p>

      <h2>6. Deine Rechte</h2>
      <p>
        Du kannst Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch verlangen und dich bei einer Aufsichtsbehörde beschweren.
        Die Löschung des Kontos mit allen Daten und der Export deiner Daten werden im Profil bereitgestellt; bis dahin genügt eine Nachricht an die oben genannte Adresse.
      </p>
    </>
  );
}

function Imprint() {
  return (
    <>
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>[Namen der Anbieter, ladungsfähige Anschrift]</p>
      <h2>Kontakt</h2>
      <p>[E-Mail-Adresse, weitere schnelle Kontaktmöglichkeit]</p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>[Name und Anschrift nach § 18 Abs. 2 MStV]</p>
      <h2>Hinweis</h2>
      <p>{APP.name} befindet sich in einer geschlossenen Testphase und ist nur mit Einladungscode zugänglich.</p>
    </>
  );
}
