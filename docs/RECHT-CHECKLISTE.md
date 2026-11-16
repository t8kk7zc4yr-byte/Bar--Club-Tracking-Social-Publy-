# Rechtliche Checkliste

Diese Liste ist eine Arbeitshilfe und ersetzt keine Rechtsberatung.

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
* [ ] Verantwortliche festlegen: gemeinsam (Art. 26 DSGVO) oder GbR
* [ ] Datenschutzhinweise und Impressum ausfüllen (§ 5 DDG, § 18 MStV)
* [ ] Hinweis auf Datenübermittlung an OpenStreetMap-Dienste (Kacheln, Overpass, Nominatim) aufnehmen

## Vor einem Launch

* [ ] Einordnung der Getränkeangaben prüfen (mögliche Nähe zu Gesundheitsdaten, Art. 9 DSGVO)
* [ ] Eigenen Kachelanbieter und eigenen Mailversand einrichten
* [ ] Löschkonzept für inaktive Konten
* [ ] Meldeweg für Inhalte (Fotos, Texte)
* [ ] Markenrecherche zum endgültigen Namen
* [ ] Vorgaben der App-Stores zu Alkoholbezug prüfen, falls eine native App folgt
