# Rechtliche Checkliste

Diese Liste ist eine Arbeitshilfe und ersetzt keine Rechtsberatung.

## Offene Entscheidungen des Teams

Festgehalten am 20.11.2026 auf Wunsch von Till; vor der Weitergabe an Freunde zu klären.

* [ ] **Verantwortlichkeit:** gemeinsam Verantwortliche (Art. 26 DSGVO, dann mit schriftlicher Vereinbarung) oder GbR. Die nicht gewählte Variante in `src/legal/datenschutz.md` und `src/legal/impressum.md` streichen.
* [ ] **Getränkeangaben:** Einordnung als Gesundheitsdaten (Art. 9 DSGVO) prüfen. Falls ja, ausdrückliche Einwilligung in der App einbauen; die App fragt sie derzeit nicht ab.
* [ ] **Löschung inaktiver Konten:** Frist festlegen (Vorschlag im Entwurf: 24 Monate ohne Anmeldung, mit Vorwarnung per E-Mail) und technisch umsetzen.
* [ ] **Impressumspflicht:** klären, ob sie schon für die geschlossene, unentgeltliche Testphase besteht (§ 5 DDG). Empfehlung: Impressum trotzdem ausfüllen.

## In der App technisch vorgesehen

* Altersangabe per Geburtsdatum ab 18; gespeichert wird nur der Zeitpunkt der Bestätigung
* Teilen mit Freunden und Foto-Freigabe standardmäßig aus (Art. 25 Abs. 2 DSGVO)
* Zugriff nur über Row Level Security; Getränke, Ausgaben und Freitext-Begleitung sind für Dritte nicht abrufbar
* Markierung anderer Personen nur mit deren Bestätigung
* Kontolöschung und Datenexport (Art. 15, 17, 20 DSGVO), Umsetzung in Phase 7
* Registrierung nur mit Einladungscode
* Keine Analysedienste, keine Inhalte von Drittservern außer Kartenkacheln und Ortssuche (OpenStreetMap)

## Vor der Weitergabe an Freunde

* [ ] Auftragsverarbeitungsvertrag mit Supabase abschließen, Unterauftragsverarbeiter prüfen (Art. 28 DSGVO)
* [ ] Datenschutzhinweise und Impressum ausfüllen (§ 5 DDG, § 18 MStV): Entwürfe in `src/legal/`, offene Stellen sind mit [[ ]] markiert, Quellen in `docs/RECHT-QUELLEN.md`
* [ ] Hinweis auf Datenübermittlung an OpenStreetMap-Dienste (Kacheln, Overpass, Nominatim) und Photon (Komoot) aufnehmen
* [ ] Hinweis auf Push-Dienste (Apple, Google) aufnehmen; in den In-App-Datenschutzhinweisen als Entwurf enthalten

## Vor einem Launch

* [ ] Eigenen Kachelanbieter und eigenen Mailversand einrichten
* [ ] Meldeweg für Inhalte (Fotos, Texte)
* [ ] Markenrecherche zum endgültigen Namen
* [ ] Vorgaben der App-Stores zu Alkoholbezug prüfen, falls eine native App folgt
