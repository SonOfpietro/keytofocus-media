# keytofocus-media – rolki Instagram @key.to.focus

Repo z silnikiem animacji, muzyką i gotowymi rolkami dla Key to Focus. Zaplanowane zadania Claude robią tu rolki i publikują je przez Metricool. Wszystko w tym repo jest publiczne: żadnych sekretów, tokenów ani kodu aplikacji.

## Cel i odbiorca
- Cel: rekrutacja testerów zamkniętego testu Google Play (Android). Tylko ruch organiczny, bez reklam.
- Odbiorca: Polacy, którzy odruchowo sięgają po telefon. Język: polski, naturalny, konkretny, lekki humor. Bez coachingu i moralizowania.

## Co aplikacja NAPRAWDĘ robi (wolno mówić)
- Android 8+ z NFC. Blokuje wybrane aplikacje i strony (strony przez lokalny filtr DNS).
- Dostęp czasowy po przyłożeniu fizycznego klucza: zgodny tag NFC, YubiKey NFC (FIDO2) albo Galaxy Watch 4 z WearAuthn.
- Klucz można odłożyć w innym miejscu, więc trzeba po niego wstać.
- Na ekranie blokady nie ma przycisku „jeszcze chwilę” / odroczenia.
- Harmonogram blokady, czas dostępu po odblokowaniu, opcjonalna ochrona przed odinstalowaniem (administrator urządzenia).
- Testy są bezpłatne. Zgłoszenia: link w bio (keytofocus.pl/#testy).

## Czego NIE mówić
- „Nie da się obejść”, „niemożliwe do wyłączenia” – aplikacja sama pisze, że to dodatkowa bariera, nie blokada nie do obejścia.
- „Dostępna w Google Play”, „pobierz teraz” – nie jest publicznie dostępna.
- Statystyki bez źródła (ile razy dziennie, ile godzin), obietnice zdrowotne, „wyleczysz uzależnienie”.
- Blokowanie samych Reels/Shorts – blokuje się całą aplikację.
- Logotypy i wierne kopie interfejsu Instagrama/TikToka/Google, prawdziwe osoby, cudza muzyka.

## Format (twarde zasady)
- 1080×1920, 30 fps, 14–20 s, H.264 + AAC, głośność −14 LUFS, true peak ≤ −1,5 dB.
- **Klatka 0 musi być od razu czytelna**: hasło wprowadzające widoczne bez animacji „dekodowania” i bez glitchu. (Rolka „14 kroków” miała rozsypany tekst na starcie i 67% przewinięć w 3 s.)
- Plansza tekstu: maks. ~6 słów, min. ~1,2 s na przeczytanie.
- Bezpieczna strefa tekstu: x 90–850, y 230–1440 (prawa krawędź i dół zajęte przez UI Instagrama).
- Pętla: koniec przechodzi w początek. Ostatnia plansza: KEY TO FOCUS / SZUKAM TESTERÓW / Android 8+ · NFC · bezpłatnie / LINK W BIO.
- Muzyka i efekty tylko syntezowane w kodzie (numpy/scipy), zsynchronizowane z wydarzeniami z timeline.json. Nigdy cudzych utworów.
- Styl: futurystyczny HUD, ciemna zieleń + mięta (#3CFFB0), cyjan, czerwień tylko przy blokadzie; fonty z engine/fonts (Unbounded, Chakra Petch, JetBrains Mono).

## Lekcje z wyników (aktualizuj po każdej analizie)
| data | rolka | wyświetlenia | przewinięcia w 3 s | wniosek |
|---|---|---|---|---|
| 03.11 | Gol. Obiad. Randka (plansze) | 141 | 59% | relatable sytuacje działają najlepiej |
| 09.11 | 14 kroków (animacja) | 62 | 67% | nieczytelna klatka 0 = przewinięcie |
| 11.11 | Jeszcze 15 minut (animacja) | 5 | 100% | podejrzenie ograniczenia zasięgu konta, nie samej treści – sprawdzić Stan konta |

## Jak powstaje rolka (procedura dla zaplanowanego zadania)
1. `npm ci` w katalogu głównym (ffmpeg, python3, numpy, scipy muszą być dostępne; doinstaluj pip install --break-system-packages, jeśli brak).
2. Przeczytaj `history.json` – nowy pomysł nie może powtarzać hasła ani motywu z ostatnich 6 rolek.
3. Sprawdź wyniki ostatnich rolek w Metricool (getAnalyticsDataByMetrics, metryki IGRE02, IGRE06, IGRE23, IGRE24, IGRE28, IGRE30) i dopisz wiersz do tabeli lekcji.
4. Wybierz jeden pomysł: jedna codzienna sytuacja + zwrot z kluczem + puenta. Sprawdź każde zdanie z sekcjami „wolno / nie wolno”.
5. Utwórz `reels/<RRRR-MM-DD>-<slug>/` na bazie najnowszej rolki: skopiuj jej `reel.mjs`, `timeline.json`, `sound.py`, przepisz sceny, teksty i wydarzenia. Zostaw wspólne narzędzia (tło, HUD, bloom, glitch, plansza końcowa).
6. Wyrenderuj klatki kontrolne (`node reel.mjs --still=0,1,…`), obejrzyj je narzędziem Read: czytelność, polskie znaki, bezpieczna strefa, brak nakładania się tekstu. Poprawiaj aż do skutku.
7. Render: `node reel.mjs --out=video_noaudio.mp4`, dźwięk: `python3 sound.py` (pisze mix.wav lub mix2.wav), złożenie:
   `ffmpeg -i video_noaudio.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -af loudnorm=I=-14:TP=-2:LRA=11 -ar 48000 -c:a aac -b:a 192k -shortest -movflags +faststart ../../media/<RRRR-MM-DD>-<slug>.mp4`
   oraz okładka `../../media/<RRRR-MM-DD>-<slug>.jpg` (najmocniejsza klatka z czytelnym hasłem).
8. Sprawdź gotowy plik: ffprobe (1080×1920, 30 fps, audio), ebur128, 6–9 klatek z gotowego MP4.
9. Commit na `main` (to repo z mediami, nie aplikacja – push do main jest tu OK), `git push`.
10. Link do filmu: `https://raw.githubusercontent.com/SonOfpietro/keytofocus-media/main/media/<plik>.mp4`. Sprawdź, że odpowiada 200 (curl -sI).
11. Metricool: createScheduledPost, blogId 7991235, providers [{"network":"instagram"}], instagramData {"type":"REEL","showReelOnFeed":true,"isAiGenerated":false}, autoPublish true, videoCoverMilliseconds = moment okładki, publicationDate w strefie Europe/Warsaw. Opis wg szablonu niżej.
12. Dopisz rolkę do `history.json` (data, slug, hasło, motyw, plik, opis, id posta Metricool) i wypchnij.

## Szablon opisu
```
<1–2 zdania: sytuacja z rolki, pierwsza osoba lub „ty”>

<1–2 zdania: jak działa Key to Focus – tylko fakty z sekcji „wolno”>

Szukam testerów: Android 8+ z NFC. Testy są bezpłatne. Zgłoszenia: link w bio.

<pytanie do widza, na które łatwo odpowiedzieć>

#KeyToFocus #mniejscrollowania #cyfrowenawyki #skupienie #Android
```
