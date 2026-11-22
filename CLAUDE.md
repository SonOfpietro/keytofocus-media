# keytofocus-media – rolki Instagram @key.to.focus

Repo z silnikiem animacji, muzyką i gotowymi rolkami dla Key to Focus. Zaplanowane zadania Claude robią tu rolki i publikują je przez Metricool. Wszystko w tym repo jest publiczne: żadnych sekretów, tokenów ani kodu aplikacji.

## Cel i odbiorca
- Cel: rekrutacja testerów zamkniętego testu Google Play (Android). Tylko ruch organiczny, bez reklam. Mamy zachęcać, nie zniechęcać.
- Odbiorca: Polacy, którzy odruchowo sięgają po telefon. Język polski, naturalny, konkretny.

## Kierunek v2 (ankieta Dawida, 18.11.2026) – OBOWIĄZUJE
Powód zmiany: rolki 15–16.11 były tym samym szablonem z podmienionym tekstem („licznik ×18 → zegar → przycisk w klucz → odmowa → puenta”), wymuszony humor, bez emocji. Tego nie powtarzamy.
- Inspiracja: konto dr Asi Wojsiat (neurobiolożka, @drjoanwojsiat) – spokój, rzetelność, jednolitość. Nie kopiujemy jej treści ani wyglądu, bierzemy spokojny, ludzki, naukowy ton.
- Ton: szczery i ludzki, spokojny i estetyczny, edukacyjny; humor tylko naturalny, sytuacyjny – nigdy puenta na siłę.
- Bohater: codzienna sytuacja widza i fizyczny klucz jako przyjemny gadżet (dotyk, dźwięk, satysfakcja).
- Stałe (jednolitość): wyłącznie paleta ciemna zieleń + mięta (#3CFFB0, szałwia #96D6BC, tło #05120D) i spokojny rytm. Wszystko inne (format, kompozycja, historia) zmienia się z rolki na rolkę – różnorodność 7/10.
- Rotacja formatów – nigdy ten sam dwa razy z rzędu, w każdych 4 kolejnych rolkach min. 3 różne:
  A) spokojna animacja-wyjaśnienie (diagram, jedna myśl, źródło),
  B) mem / POV (jedna sytuacja, 1–3 plansze, ludzki żart),
  C) ilustrowana mini-scenka (postać, mieszkanie, krótka historia),
  D) pokaz aplikacji krok po kroku (prawdziwe ekrany i klucz – z materiałów Dawida).
- Długość zależy od pomysłu (ok. 7–25 s). Lepiej krótko i spokojnie niż długo i gęsto.
- Edukacja tylko ze źródłem: nazwisko badacza / książka na ekranie lub w opisie. Bez statystyk bez źródła.
- Wzorzec stylu v2: `reels/2026-11-18-petla-nawyku/` (paleta, fonty Manrope + JetBrains Mono, łagodne przejścia, plansza końcowa, spokojny dźwięk). Z niego bierzesz WYŁĄCZNIE narzędzia stylu i planszę końcową. **Sceny, kompozycję i dźwiękowy motyw piszesz za każdym razem od nowa.** Kopiowanie scen z poprzedniej rolki = błąd.
- Zakazane efekty: glitch, RGB split, trzęsienie ekranu, błyski, licznik ×N, eksplodujący zegar, neonowy fiolet/czerwień, gęsty HUD.
- Zatwierdzanie: pierwsze 3 rolki w nowym stylu Dawid zatwierdza przed publikacją (zadanie w panelu z linkiem do pliku; publikacja dopiero po jego „OK” w zakładce DLA CLAUDE). Potem publikacja automatyczna. Rytm: 3 rolki tygodniowo.
- Zatwierdzone przez Dawida w nowym stylu: 2/3 (Pętla nawyku 18.11 – format A, canvas; Po klucz 21.11 – format B, HyperFrames).
- Silniki: canvas (`reels/2026-11-18-petla-nawyku/reel.mjs`) albo HyperFrames (HTML/CSS/GSAP → wideo; wzorzec techniczny `reels/2026-11-21-po-klucz/`). HyperFrames działa w chmurze: `export HYPERFRAMES_BROWSER_PATH=/usr/bin/google-chrome`, GSAP i fonty lokalnie w `assets/` (bez CDN), `npx --yes hyperframes@0.8.157 check`, potem `render -o video_noaudio.mp4 -q delivery` (~50 s na 15 s filmu); klatki kontrolne wyciągasz ffmpegiem z renderu. Ostrzeżenia `nested_structure_needs_subcomposition` są niegroźne; cutmate (github.com/wisniewskib/cutmate) to montaż nagrań z mówieniem do kamery – przyda się, jeśli Dawid zacznie nagrywać siebie.
- Materiał od Dawida: ok. 15 min nagrań tygodniowo (telefon, klucz, ręka, bez twarzy) – patrz lista ujęć w `NAGRANIA.md`.

## Akceptacja i publikacja (zadanie zaplanowane „KTF rolka Instagram”)
- Rytm publikacji: pon 18:30, śr 19:00, pt 18:00 (Europe/Warsaw). Zadanie startuje nd–pt o 14:43.
- Nd/wt/czw = PRODUKCJA rolki na następny dzień. Pn/śr/pt = PUBLIKACJA.
- Dopóki licznik „Zatwierdzone przez Dawida” < 3/3: produkcja kończy się zadaniem w panelu `tasks/rolka-<data publikacji>` (link do MP4, opis, instrukcja). W history.json wpis ze `status: "czeka"`. Publikacja planuje post tylko, jeśli Dawid dał OK: wiadomość w zakładce DLA CLAUDE (inbox) z „OK” albo odhaczone zadanie rolki. Prośba o poprawki → poprawiasz, wypychasz, aktualizujesz zadanie, nie publikujesz. Brak odpowiedzi → nie publikujesz, zadanie dostaje priorytet „pilne”.
- Po OK: createScheduledPost, `status: "zaplanowana"` + metricool_id w history.json, licznik w tym pliku +1, zadanie w panelu `done`.
- Od 3/3: produkcja od razu planuje post na następny dzień (bez zadania w panelu), publikacja tylko sprawdza, że post jest w Metricool.

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
- 1080×1920, 30 fps, długość wg pomysłu (ok. 7–25 s), H.264 + AAC, głośność −14 LUFS, true peak ≤ −1,5 dB.
- **Klatka 0 musi być od razu czytelna**: hasło wprowadzające widoczne bez animacji „dekodowania” i bez glitchu. (Rolka „14 kroków” miała rozsypany tekst na starcie i 67% przewinięć w 3 s.)
- Plansza tekstu: maks. ~6 słów, min. ~1,2 s na przeczytanie.
- Bezpieczna strefa tekstu: x 90–850, y 230–1440 (prawa krawędź i dół zajęte przez UI Instagrama).
- Ostatnia plansza (styl v2): logo, „Key to Focus”, „Szukam testerów”, „Android 8+ z NFC · bezpłatnie”, „link w bio”.
- Muzyka i efekty tylko syntezowane w kodzie (numpy/scipy), zsynchronizowane z wydarzeniami z timeline.json. Nigdy cudzych utworów.
- Styl: patrz „Kierunek v2” – ciemna zieleń + mięta, spokojny ruch, fonty Manrope + JetBrains Mono (engine/fonts). Unbounded/Chakra Petch i futurystyczny HUD tylko jako rzadki akcent formatu A, nigdy jako szablon.

## Lekcje z wyników (aktualizuj po każdej analizie)
| data | rolka | wyświetlenia | przewinięcia w 3 s | wniosek |
|---|---|---|---|---|
| 03.11 | Gol. Obiad. Randka (plansze) | 141 | 59% | relatable sytuacje działają najlepiej |
| 05.11 | Tylko sprawdzę godzinę (plansze) | 114 | 59% | śr. 5,9 s; plansze trzymają widza najdłużej |
| 09.11 | 14 kroków (animacja) | 62 | 67% | nieczytelna klatka 0 = przewinięcie |
| 11.11 | Jeszcze 15 minut (animacja) | 5 | 100% | podejrzenie ograniczenia zasięgu konta, nie samej treści – sprawdzić Stan konta |
| 15.11 | Najpierw wstań (animacja) | 60 | 83% | śr. 3,3 s (plansze 5,9–7,6 s); zasięg wrócił, ale neutralne „Budzik: 06:30.” nad gęstą animacją nie zatrzymuje → na klatce 0 duże hasło-sytuacja z ukrytym żartem, tekst ważniejszy od animacji |
| 16.11 | Na 2 minuty (animacja, stary szablon) | 80 | 74% | śr. 2,9 s – ten sam szablon co 15.11 już nie trzyma; potwierdza decyzję o kierunku v2 |
| 18.11 | Pętla nawyku (A, v2) | 199 | 76% | śr. 5,3 s – rekord wyświetleń; spokojne wyjaśnienie ze źródłem trzyma dłużej niż stary szablon, ale start wciąż do poprawy |
| 21.11 | Po klucz (B, POV, v2) | 159 (po ~1 dniu) | 63% | śr. 4,9 s – najmniej przewinięć ze wszystkich animacji; ludzka sytuacja + jasne hasło „POV” na klatce 0 działa |

## Jak powstaje rolka (procedura dla zaplanowanego zadania)
1. `npm ci` w katalogu głównym (ffmpeg, python3, numpy, scipy muszą być dostępne; doinstaluj pip install --break-system-packages, jeśli brak).
2. Przeczytaj `history.json` – nowy pomysł nie może powtarzać hasła ani motywu z ostatnich 6 rolek.
3. Sprawdź wyniki ostatnich rolek w Metricool (getAnalyticsDataByMetrics, metryki IGRE02, IGRE06, IGRE23, IGRE24, IGRE28, IGRE30) i dopisz wiersz do tabeli lekcji.
4. Wybierz format wg rotacji (sprawdź pole `format` w history.json) i jeden pomysł: codzienna sytuacja lub jedna rzetelna myśl + klucz. Sprawdź każde zdanie z sekcjami „wolno / nie wolno”.
5. Utwórz `reels/<RRRR-MM-DD>-<slug>/`. Narzędzia stylu i planszę końcową weź z `reels/2026-11-18-petla-nawyku/`; sceny, kompozycję, ruch i motyw dźwiękowy napisz od nowa pod wybrany format.
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
