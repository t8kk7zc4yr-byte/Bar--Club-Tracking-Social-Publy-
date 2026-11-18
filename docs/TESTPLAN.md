# Testplan für die Demo (iPhone)

Für Till, Matteo und Leon. Jeder Punkt wird mit zwei Konten durchgespielt (A und B). Fehler bitte mit Gerät, iOS-Version, Zeitpunkt und einem Screenshot melden.

## Vorbereitung

1. App in Safari öffnen, **Teilen**, **Zum Home-Bildschirm**, von dort öffnen (Icon: pinkes Cocktailglas).
2. Registrieren mit Einladungscode; Mail bestätigen; anmelden.
3. Im Profil **Mit Freunden teilen** einschalten und **Push auf diesem Gerät** aktivieren.
4. A und B vernetzen sich per Freundescode (Freunde, Anfrage senden, Annehmen).

## Ablauf

| Nr. | Test | Erwartung |
|:---|:---|:---|
| 1 | Registrierung mit Geburtsdatum unter 18 | wird abgelehnt |
| 2 | Check-in über das Plus: Standort erlauben | „Du bist vermutlich hier“ nennt Locations in der Nähe |
| 3 | Check-in mit Bewertung, Tags, Getränken, Ausgaben, Selfie | gespeichert; erscheint auf Dashboard, Ranking, Karte |
| 4 | A checkt ein | B erhält Push „A ist eingecheckt“, auch bei geschlossener App |
| 5 | A schaltet „Ich bin unterwegs“ ein | B erhält Push; B sieht A unter „Gerade unterwegs“; Status endet automatisch |
| 6 | A markiert B im Check-in | B erhält Push, bestätigt, trägt den Besuch bei sich ein |
| 7 | A gibt ein Foto frei (Foto antippen, Freigabe) | B sieht es im Feed; nach Rücknahme nicht mehr |
| 8 | A und B checken am selben Abend in drei Locations ein | Tour entsteht; B kann der Tour von A beitreten; Route auf der Karte |
| 9 | A schaltet „Mit Freunden teilen“ aus | B sieht nichts mehr von A (Feed, Tipps, unterwegs) |
| 10 | Flugmodus an, Check-in anlegen, Flugmodus aus | Eintrag wird nachträglich übertragen |
| 11 | Hell/Dunkel im Profil umschalten | alle Seiten lesbar |
| 12 | Jahresrückblick teilen (Dashboard) | drei Bilder, Teilen-Menü von iOS öffnet sich |
| 13 | Export im Profil | JSON-Datei mit allen Daten wird erzeugt |
| 14 | Abmelden und neu anmelden | Daten sind wieder da |
| 15 | Konto löschen (nur mit Testkonto!) | alles weg; Anmeldung danach nicht mehr möglich |

## Bekannte Einschränkungen

* Push auf dem iPhone funktioniert nur aus der App auf dem Home-Bildschirm (iOS 16.4 oder neuer).
* Die erste Benachrichtigung nach längerer Pause kann einige Sekunden dauern.
* Kartenkacheln stammen vom öffentlichen OpenStreetMap-Server und sind nur für wenige Tester gedacht.
* Der kostenlose Mailversand von Supabase ist auf wenige Mails pro Stunde begrenzt; bei mehreren Registrierungen kann die Bestätigungsmail ausbleiben.
* Das Teilen von Bildern aus dem Rückblick hängt von der Zielanwendung ab.
