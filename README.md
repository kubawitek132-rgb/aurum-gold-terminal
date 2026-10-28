# AURUM // Gold Macro & Geo Intelligence

Dashboard z globem 3D, który pokazuje **tło i przyczyny** ruchów złota w horyzoncie tygodni i miesięcy: politykę banków centralnych, czynniki makro, ryzyko geopolityczne według regionów, wąskie gardła żeglugi, rynek fizyczny i kalendarz strukturalny złota.

AURUM celowo **nie dubluje GOLD DESK**: nie ma tu ceny tick po ticku, techniki, order flow, syntezy AI, kalendarza publikacji USD ani alertów przed nimi. GOLD DESK odpowiada na pytanie „co i kiedy na wykresie”, AURUM na pytanie „dlaczego i w jakim otoczeniu”.

```
┌ TOP BAR: logo · zegar WAW/UTC · status danych · TŁO MAKRO ▲/▼ · CYKL BANKÓW · najbliższe zdarzenie złota ┐
├──────┬──────────────────────────────────────────────────────────────┬───────────────────────────────┤
│ ⌂ CB │                                                              │ TŁO MAKRO · TYGODNIE          │
│ ◷ CAL│                GLOB 3D ⇄ MAPA 2D  (MAP / SAT)                │ PULS BANKÓW CENTRALNYCH       │
│ ◎ RSK│   klik w marker = szczegóły · klik w kraj = dossier          │ RYZYKO GEOPOLITYCZNE · REGIONY │
│ ⚠ GEO│                                                              │ KALENDARZ STRUKTURALNY ZŁOTA  │
│ ⧖ CHK│                                                              │ SEZONOWOŚĆ XAUUSD             │
│ ◆ AU │                                                              │ OFICJALNE REZERWY ZŁOTA       │
│ ▣ RES│                                                              │                               │
│ ◐ D/N│                                                              │                               │
├──────┴──────────────────────────────────────────────────────────────┴───────────────────────────────┤
│ MACRO ▸ REAL 10Y · BEI 10Y · USD BROAD · FED FUNDS · 10Y–2Y · HY SPREAD · FED BS · BRENT · WTI (zmiany tyg.) │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

> ⚠️ Narzędzie informacyjne. Oceny „sprzyja / szkodzi” to jawne reguły opisujące kontekst — **nie są sygnałami transakcyjnymi**.

---

## Co jest w środku

### Warstwy mapy

| Warstwa | Co pokazuje | Źródło |
|---|---|---|
| ⌂ BANKI CENTRALNE | 13 banków (Fed, ECB, BoJ, BoE, SNB, PBoC, RBA, BoC, RBNZ, NBP, RBI, CBR, BCB). Kolor = kierunek polityki z ostatnich 180 dni (czerwony zacieśnianie, zielony luzowanie, szary pauza), jasny pierścień = bank kupujący złoto. Popup: stopa, ostatnia zmiana, następna decyzja z odliczaniem, rezerwy i trend. | `src/data/central-banks.json` |
| ◷ DECYZJE I PUBLIKACJE | Decyzje banków (w tym Fed) i publikacje high/medium **spoza USD** na 7 lub 30 dni. Kolor: złoty = decyzja banku, czerwony = high, pomarańczowy = medium. | JSON banków + ForexFactory |
| ◎ RYZYKO REGIONÓW | 6 regionów: Bliski Wschód, Rosja–Ukraina, Cieśnina Tajwańska, Morze Czerwone, Półwysep Koreański, wojny handlowe/sankcje. Wielkość i kolor = indeks intensywności relacji (ostatnie 3 dni vs średnia z 30 dni). Popup: wykres 30 dni, zdarzenia z mapy, znaczenie dla złota. | GDELT `timelinevol` |
| ⚠ ZDARZENIA GEO 24H | Pojedyncze zdarzenia (konflikty, sankcje, cła, rozejmy) z linkiem do artykułu + heatmapa. | GDELT DOC 2.0 |
| ⧖ CHOKEPOINTY | Ormuz, Bab el-Mandeb, Suez, Malakka, Bosfor, Kanał Panamski: NORMAL / ELEVATED / DISRUPTED, nagłówki, tygodniowa zmiana Brent i WTI, opcjonalnie statki i tankowce z AIS. | GDELT + FRED + aisstream.io |
| ◆ RYNEK FIZYCZNY | 9 hubów (LBMA, COMEX, Zurych, SGE, Hongkong, Dubaj, Mumbaj, Singapur, Stambuł), animowane przepływy fizycznego złota, choropleth producentów. Popup hubu pokazuje najbliższe zdarzenia strukturalne tego rynku. | `gold-market.json` |
| ▣ REZERWY ZŁOTA | Choropleth oficjalnych rezerw 34 krajów. | `reserves.json` (WGC, przybliżenie) |
| ◐ DZIEŃ / NOC | Terminator. | obliczenia lokalne |

**Dossier kraju:** klik w dowolny kraj otwiera kartę z rezerwami złota i trendem, produkcją, walutą, bankiem centralnym (stopa, kierunek, odliczanie), regionem ryzyka, informacją o sankcjach, najbliższymi decyzjami/publikacjami i odległością do hubu i chokepointu. Klik w ocean pokazuje lokalizację; kolejny klik w puste miejsce zamyka kartę.

### Panele (prawa kolumna)

- **CO SIĘ ZMIENIŁO** — skrót dnia: które czynniki makro zmieniły ocenę, bilans tła vs tydzień temu, przesunięcie oczekiwań wobec Fed i prawdopodobieństwa recesji, zmiany poziomu regionów ryzyka i GPR, zmiany statusu chokepointów (vs wczoraj), decyzje banków z 48 h, zakupy złota wg IMF i kalendarz na 7 dni. Ten sam skrót rano na Telegramie.

- **TŁO MAKRO · TYGODNIE** — 7 czynników z jawnymi regułami (próg i horyzont w podpowiedzi) i wykresem 6 miesięcy:

  | Czynnik (FRED) | Horyzont | Sprzyja złotu, gdy… |
  |---|---|---|
  | Realna rentowność 10Y (`DFII10`) | 4 tyg. | spada o > 10 bp |
  | Dolar Broad Index (`DTWEXBGS`) | 4 tyg. | spada o > 1% |
  | Breakeven inflacji 10Y (`T10YIE`) | 4 tyg. | rośnie o > 8 bp |
  | Fed funds (`DFF`) | 3 mies. | spada o > 10 bp |
  | Spread high yield (`BAMLH0A0HYM2`) | 4 tyg. | rośnie o > 40 bp (stres) |
  | Bilans Fed (`WALCL`) | 13 tyg. | rośnie o > 1% |
  | Brent (`DCOILBRENTEU`) | 4 tyg. | rośnie o > 10% |

  | Oczekiwania wobec Fed (`DGS1 − DFF`) | 4 tyg. | spada o > 15 bp (rynek dokłada obniżek) |
  | VIX (`VIXCLS`) | 4 tyg. | rośnie o > 5 pkt (ucieczka od ryzyka) |

  Ruch w przeciwnym kierunku powyżej progu = „szkodzi”, poniżej progu = „neutralnie”.
  - **Bilans tła · 52 tyg.** — wykres: ile czynników sprzyjało, a ile szkodziło w każdym tygodniu ostatniego roku, liczony wstecz z tych samych serii FRED i tymi samymi regułami.
  - **Kafelki:** oczekiwania wobec Fed (1Y − EFFR w pb i zmiana w 4 tyg.), VIX, **prawdopodobieństwo recesji w USA za 12 mies.** — model NY Fed (probit na spreadzie 10Y–3M, `T10Y3M`), liczony w aplikacji.
- **PULS BANKÓW CENTRALNYCH** — globalny kierunek (zacieśnianie / luzowanie / mieszany / pauza), kto podnosił i obniżał w 180 dni, którzy kupują złoto, decyzje w najbliższych 30 dniach z odliczaniem.
- **RYZYKO GEOPOLITYCZNE · REGIONY** — na górze **indeks GPR** (Caldara–Iacoviello, Federal Reserve Board; dzienny, aktualizowany w poniedziałki): poziom (średnia 7 dni względem roku), wykres 90 dni i opisane zdarzenia. Pod nim ranking regionów GDELT z poziomem (LOW / NORMAL / ELEVATED / HIGH) i wykresem 30 dni.
- **ZAKUPY ZŁOTA · BANKI CENTRALNE** — IMF IRFCL (oficjalne rezerwy złota, miesięcznie, bez klucza): stan w tonach, zmiana m/m i 12 mies., wykres 13 mies., saldo netto ostatniego miesiąca. Te same dane zasilają warstwę rezerw na mapie.
- **KALENDARZ STRUKTURALNY ZŁOTA** — 75 dni do przodu:
  - **COMEX** liczony wg reguł CME: wygasanie opcji OG (4. od końca dzień roboczy miesiąca poprzedzającego, przesunięty, gdy wypada w piątek lub przed świętem), First Notice Day (ostatni dzień roboczy miesiąca poprzedzającego), ostatni dzień handlu (3. od końca dzień roboczy miesiąca kontraktu). Święta USA liczone automatycznie (w tym Wielki Piątek).
  - **Dane:** najbliższy raport CFTC COT, rezerwy PBoC (~7. dnia miesiąca, szac.), WGC Gold Demand Trends (szac.).
  - **Święta i sezony popytu:** LBMA, COMEX, SGE (Chiński Nowy Rok), Dhanteras/Diwali, sezon weselny w Indiach, zakupy przed Chińskim Nowym Rokiem — z `src/data/gold-calendar.json`.
- **REAKCJA ZŁOTA NA ZDARZENIA** — średni ruch XAU/USD w dniu zdarzenia i do 5 sesji po, odsetek wzrostów i liczba przypadków od ok. 2006 r.: podwyżki i obniżki Fed, podwyżki i obniżki ECB, wygasanie opcji OG, First Notice Day, szczyty GPR (wymaga klucza Twelve Data; 1 zapytanie na dobę).
- **SEZONOWOŚĆ XAUUSD** — średnia, mediana i odsetek lat wzrostowych dla każdego miesiąca (wymaga klucza Twelve Data; 1 zapytanie na dobę).
- **OFICJALNE REZERWY ZŁOTA** — top 15 krajów, wyróżnieni kupujący.
- **STATUS ŹRÓDEŁ** — które klucze są ustawione (FRED, Twelve Data, AIS, Telegram, Redis) i stan każdego źródła: OK / ŁADUJE / STALE / BRAK z czasem aktualizacji; po najechaniu — źródło lub treść błędu.

**Pasek MACRO** na dole: wartości i zmiany tygodniowe czynników tła (bez notowań XAU).

**Stopy Fed i ECB aktualizują się same** z FRED (`DFEDTARU`/`DFEDTARL`, `ECBDFR`) — popup banku pokazuje „FRED — aktualizacja automatyczna”. Pozostałe banki: z pliku `central-banks.json` z przypomnieniem po każdym posiedzeniu.

**Tylko prawdziwe dane:** aplikacja nie generuje wartości zastępczych. Gdy źródło nie ma klucza albo chwilowo nie odpowiada, panel lub warstwa pokazuje „brak danych”, a reszta działa dalej.

**Top bar:** liczba czynników makro sprzyjających/szkodzących, globalny cykl banków, najbliższe zdarzenie strukturalne złota z odliczaniem.

**Legenda** (lewy dolny róg mapy) objaśnia kolory wszystkich warstw.

**Skróty klawiszowe:** `Esc` zamyka kartę i szuflady · `1`–`8` włącza/wyłącza warstwy (w kolejności z lewego paska) · `G` globus 3D / mapa 2D · `S` podkład satelitarny · `L` legenda. Ustawienia warstw, widoku i legendy zapamiętuje przeglądarka.

### Co celowo usunięto (jest w GOLD DESK)

Ticker z ceną XAU i par FX, Gold Bias Gauge, COT i GLD, korelacje, newsy, sesje i killzones, kalendarz USD z banerem 15 min i alerty przed publikacjami.

---

## Szybki start lokalnie

Wymagania: **Node.js ≥ 20** (22 zalecany — wymagany dla AIS), npm.

```bash
cd aurum
cp .env.example .env        # wpisz przynajmniej FRED_API_KEY
npm install
npm run dev                 # http://localhost:3000
```

Produkcyjnie: `npm run build && npm start`. Diagnostyka źródeł: `http://localhost:3000/api/status` (lub panel STATUS ŹRÓDEŁ).

Testy logiki (reguły CME, indeks ryzyka, klasyfikacja nagłówków, kalendarz, cache, spójność plików JSON): `npm test`.
Sprawdzenie, czy dane banków są aktualne: `npm run check-banks` (kod wyjścia 1, gdy po którymś posiedzeniu trzeba wpisać wynik — nadaje się do crona).

## Klucze API

| Zmienna | Gdzie | Do czego | Wymagany? |
|---|---|---|---|
| `FRED_API_KEY` | https://fredaccount.stlouisfed.org → API Keys | TŁO MAKRO, pasek MACRO, ropa w chokepointach | tak (bez niego panele makro pokazują „brak danych”) |
| `TWELVEDATA_API_KEY` | https://twelvedata.com → API Keys | tylko SEZONOWOŚĆ (1 kredyt/dobę) | nie |
| `AISSTREAM_API_KEY` | https://aisstream.io (logowanie GitHubem) | statki i tankowce w chokepointach | nie |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | @BotFather; `chat.id` z `https://api.telegram.org/bot<TOKEN>/getUpdates` | alerty tła | nie |

Bez klucza działają: kalendarz ForexFactory, GDELT (zdarzenia, regiony, chokepointy), dane statyczne i kalendarz strukturalny.

## Wdrożenie na VPS (Docker) — jednym poleceniem

Na serwerze (Debian/Ubuntu, dowolna architektura — także ARM):

```bash
curl -fsSL https://raw.githubusercontent.com/kubawitek132-rgb/aurum-gold-terminal/main/deploy/bootstrap.sh | sudo bash
```

albo z Maca, przez SSH (adres jak w `~/.ssh/config` lub nazwa z Tailscale): dwuklik w `~/Public/AURUM — wdróż na VPS.command`, ewentualnie `bash ~/Public/aurum-deploy.sh user@vps`.

`deploy/bootstrap.sh` pobiera kod z GitHuba do `/opt/aurum` (wcześniejsza instalacja z paczki zip jest przejmowana, `.env` i dane zostają), uruchamia `deploy/install.sh` i włącza **automatyczne aktualizacje**: co 30 minut `deploy/update.sh` sprawdza gałąź `main`, a po nowym commicie przebudowuje kontener; jeśli nowa wersja nie wstanie, wraca do poprzedniej. Log: `/var/log/aurum-update.log`, ręcznie: `sudo bash /opt/aurum/deploy/update.sh`, wyłączenie: `AURUM_AUTOUPDATE=0` przy instalacji albo usunięcie `/etc/cron.d/aurum-update`.

Skrypt `deploy/install.sh` instaluje Dockera (jeśli brak), tworzy `.env` i pyta o klucze (Enter = pomiń), generuje `ALERTS_SECRET`, buduje i uruchamia kontener, sprawdza `/api/status`, a gdy na serwerze działa Tailscale — wystawia aplikację w tailnecie przez HTTPS na porcie **8443** (`https://<serwer>.<tailnet>.ts.net:8443`, osobny port, żeby nie kolidować z innymi usługami). Uruchomienie ponowne = aktualizacja (istniejący `.env` zostaje). Opcje: `AURUM_REDIS=1` (trwały cache w Redis), `AURUM_TS_PORT=…`, `AURUM_NONINTERACTIVE=1`.

**CI:** workflow `.github/workflows/ci.yml` przy każdym pushu robi typecheck, testy i `next build`, a z gałęzi `main` publikuje obraz `ghcr.io/<konto>/aurum:latest`.

Ręcznie, krok po kroku:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo mkdir -p /opt/aurum && sudo chown $USER /opt/aurum
rsync -av --exclude node_modules --exclude .next ./aurum/ user@vps:/opt/aurum/
cd /opt/aurum && cp .env.example .env && nano .env
docker compose up -d --build            # z Redis: docker compose --profile redis up -d --build
docker compose logs -f aurum
```

Kontener nasłuchuje na `127.0.0.1:3000` — wystaw go przez nginx z HTTPS i hasłem (`deploy/nginx.conf.example`) albo przez Tailscale (`tailscale serve 3000`).

## VPS bez Dockera (systemd)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo useradd -r -s /usr/sbin/nologin aurum
cd /opt/aurum && cp .env.example .env && nano .env
npm ci || npm install
npm run build
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
sudo chown -R aurum:aurum /opt/aurum
sudo cp deploy/aurum.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now aurum
```

## Alerty Telegram

- **Poranny skrót** (`DIGEST_HOUR`, domyślnie 8:00 czasu warszawskiego) — zawartość panelu CO SIĘ ZMIENIŁO. Wysyłka raz dziennie; stan „wysłano” trwa po restarcie (Redis lub `DATA_DIR`). Ręcznie: `POST /api/alerts?digest=1`.
- **Zmiana bilansu tła** (`ALERT_MACRO_FLIP`) — gdy przewaga przechodzi z czynników sprzyjających na szkodzące lub odwrotnie.


Tylko zdarzenia tła (GOLD DESK obsługuje alerty przed publikacjami):
- region ryzyka przechodzi na poziom **HIGH**,
- chokepoint zmienia status na **DISRUPTED**,
- dzień przed decyzją banku centralnego spoza USD (`ALERT_CB_REMINDER=false` wyłącza).

`POST /api/alerts?test=1` wysyła wiadomość testową, `GET /api/alerts` pokazuje stan i log.

## Źródła i odświeżanie

| API | Źródło | Cache |
|---|---|---|
| `/api/macro` | FRED (16 serii, równolegle) | 6 h |
| `/api/policy`, `/api/banks` | `central-banks.json` | — |
| `/api/calendar` | JSON banków + ForexFactory (spoza USD) | 30 min |
| `/api/regions` | GDELT `timelinevol` (6 zapytań, 30 dni) | 3 h |
| `/api/geo` | GDELT DOC artlist 24h + gazeter | 15 min |
| `/api/chokepoints` | GDELT 48h + AIS | 30 min |
| `/api/hubs` | `gold-market.json`, `reserves.json` | — |
| `/api/goldcal?days=75` | reguły CME + `gold-calendar.json` | liczone na żądanie |
| `/api/seasonality` | Twelve Data, XAU/USD miesięcznie | 24 h |
| `/api/digest` | skrót „co się zmieniło” z pozostałych źródeł | liczony na żądanie |
| `/api/gpr` | GPR dzienny (plik .xls ze strony autorów) | 12 h |
| `/api/cbgold` | IMF SDMX, dataset IRFCL (złoto, uncje → tony) | 24 h |
| `/api/reactions` | Twelve Data XAU/USD dziennie + FRED (`DFEDTAR`, `DFEDTARU`, `ECBDFR`) + reguły CME + GPR | 24 h |
| `/api/status` | diagnostyka | — |

Każde źródło ma własny provider; gdy nie odpowiada, warstwa pokazuje **STALE** z czasem ostatniej aktualizacji, a reszta działa. Opcjonalny Redis (`REDIS_URL`) przechowuje ostatnie dane między restartami.

**Płynność działania:**
- Cache działa w trybie *stale-while-revalidate*: po upływie TTL API od razu oddaje ostatnie dane, a odświeżenie idzie w tle — żadne żądanie z przeglądarki nie czeka na wolne źródło (np. kolejkę GDELT, która przy 6 regionach trwa ~40 s).
- Przy pierwszym starcie serwer czeka na źródło najwyżej 6 s, potem oddaje dane zastępcze z flagą „ładowanie”; przeglądarka dopytuje co 15 s, aż przyjdą prawdziwe (status w top barze: ŁADOWANIE).
- Serie FRED pobierane równolegle; GDELT przy komunikacie o limicie zapytań ponawia raz po 6 s; błąd jednego regionu nie wyłącza całej warstwy.
- Przeglądarka: po błędzie sieci ponawia po 10, 20, 40 s…; po powrocie do karty lub odzyskaniu internetu odświeża dane starsze niż minuta.
- Mapa: rotacja globu liczona co klatkę, efekty ~30 kl./s tylko dla włączonych warstw, karta szczegółów przesuwana bez przerysowywania interfejsu; `prefers-reduced-motion` wyłącza animacje. Brak WebGL lub błąd mapy nie blokuje paneli.

## Aktualizacja danych statycznych

- `central-banks.json` — stopy, ostatnia zmiana (data i bp, z niej liczony jest kierunek), daty posiedzeń w UTC (oficjalne kalendarze do końca 2027 r.; SNB i RPP — do ogłoszenia ich kalendarzy 2027), rezerwy. Gdy minie posiedzenie późniejsze niż `asOf`, popup banku sam przypomina o wpisaniu wyniku. Pole `verify` pokazuje w popupie, co trzeba potwierdzić. **Stan na 16.10.2026, sprawdzony ze źródłami:** stopy, ostatnie zmiany i najbliższe daty wszystkich 13 banków. Do aktualizacji co miesiąc: tonaż NBP (ostatnie dane: 632 t, koniec VI 2026) i BCB; po każdym posiedzeniu dopisz `lastChange`, jeśli bank zmienił stopę, i nowe daty w `meetings`.
- `reserves.json` — rezerwy wg WGC (gold.org → Gold reserves by country).
- `gold-calendar.json` — święta i sezony popytu na kolejne miesiące (np. daty Chińskiego Nowego Roku z komunikatu SGE).
- `regions.json` — regiony ryzyka i zapytania GDELT (łatwo dodać nowy region).
- `chokepoints.json`, `gold-market.json`, `src/lib/gazetteer.ts`.

## Architektura

```
src/
├─ app/api/*            macro, policy, banks, calendar, regions, geo, chokepoints, hubs, goldcal, seasonality, alerts, status
├─ components/          Terminal, MapView (MapLibre + deck.gl), TopBar, MacroTape, LayerBar, RightPanel, MapPopup, Legend
├─ lib/providers/       fred · ffcalendar · gdelt · aisstream · twelvedata · mock   ← jedno źródło = jeden plik
├─ lib/services/        macro (tło + pasek), data (banki, kalendarze, regiony, chokepointy, huby, sezonowość), alerts
├─ lib/goldCalendar.ts  reguły CME, święta USA, cykliczne publikacje
├─ lib/cache.ts, redis.ts, scheduler.ts, popups.ts, features.ts, geo.ts, time.ts
└─ data/                statyczne JSON
tests/                  npm test (node:test + tsx)
scripts/check-banks.mjs aktualność danych banków
```

## Ograniczenia

- Indeks regionów mierzy **intensywność relacji medialnych**, nie skalę zdarzeń — to wskaźnik uwagi rynku.
- Geotag zdarzeń GDELT na podstawie nazw miejsc w nagłówku; klasyfikacja wpływu to heurystyka słów kluczowych.
- Kierunek polityki banku wynika z daty i znaku ostatniej zmiany w JSON — bez aktualizacji pliku robi się nieaktualny (popup pokazuje `verify`).
- Daty COMEX liczone regułami CME z uproszczonym kalendarzem świąt — przed ważną datą potwierdź w kalendarzu CME.
- Premie hubów (SGE, Indie) nie mają darmowego API — pole do ręcznego uzupełnienia.
- Heatmapa i punkty to natywne warstwy MapLibre (stabilniejsze na globie); deck.gl obsługuje przepływy złota.

Dane: FRED (Federal Reserve Bank of St. Louis), GDELT Project, ForexFactory, World Gold Council (przybliżenia), CME Group (reguły kontraktów), Twelve Data. Mapy: © OpenStreetMap contributors, © CARTO, Esri.

## Biuro (`/biuro`)

Przestrzenna centrala BiuroHQ, Coin Bota i AURUM, z wykazem stanowisk i publicznymi danymi rynku. Istniejący Coin Bot korzysta z Solany, DEX-ów/Jupiter i oddzielnego portfela podpisującego na serwerze. Phantom służył do zasilenia tego portfela. HQ nie podpisuje transakcji ani nie odczytuje prywatnych sald; saldo i transakcje pozostają w terminalu bota. Panel opisuje architekturę, bez potwierdzania bieżącej pracy silnika.

Coinbase/Kraken i wyszukiwarka DEX dostarczają HQ niezależne odczyty rynku. Nie oznaczają podłączenia tych giełd do silnika bota. Wrapped BTC/ETH na Solanie nie są potwierdzeniem egzekucji na natywnych sieciach Bitcoin/Ethereum.

Historyczny raport firmy pozostaje pod `/biuro/desk`. Jego snapshot (`public/biuro-status.json`: `firm`, `projects`, `executives`, `departments`, `observers`, `ideas`, `botFactory`, `paperBlotter`, `metrics`, `risk`) opisuje oddzielny projekt Cursor/Origin Coin Bot BTC/ETH w trybie paper. Wynik paper nie jest saldem istniejącego bota Solana. Zapisany token MetaMask CLI nie potwierdza uwierzytelnionej egzekucji. CI AURUM idzie osobno, z publicznego GitHub API (job `build` na `main`).

Odświeżenie:

1. Uzupełnij snapshot. `paperBlotter.pnlUsd` ma równać się sumie `pnlUsd` filli, `exposureUsd` sumie nominałów z `open: true`. Metryki w `metrics` trzymaj zgodne z blotterem.
2. Nowy pomysł: obiekt w `ideas[]` z `title`, `status` (`kolejka` | `research` | `odrzucone`), `thesis`, `invalidation`, `source`, `next`. Bez tezy i invalidation karta nie wchodzi.
3. Wgraj commit na `main`. Raport robi `fetch /biuro-status.json`. Gdy plik nie dojdzie, zostaje treść w `public/biuro.html`.
4. Bez kluczy, bez syncu prywatnego coin-bot, bez zleceń live.
