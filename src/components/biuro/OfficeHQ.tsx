"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { BiuroMarketsSnapshot } from "@/lib/biuroMarkets";
import { BotWalletPanel } from "./BotWalletPanel";
import { CoinExplorer } from "./CoinExplorer";
import {
  BIURO_STRUCTURE,
  getFloorInventory,
  type BiuroFloorInventory,
} from "@/lib/biuroStructure";
import styles from "./OfficeHQ.module.css";

const BuildingScene = dynamic(() => import("./BuildingScene"), {
  ssr: false,
  loading: () => (
    <div className={styles.sceneLoading}>
      <span>▥</span>Otwieranie budynku…
    </div>
  ),
});
const AURUM_URL = "https://xauinteligenceooffice.com";
const FLOORS = [
  {
    id: "hq",
    level: "03",
    name: "BiuroHQ",
    role: "Zarząd i nadzór",
    color: "#c9f36a",
    icon: "▦",
  },
  {
    id: "coin",
    level: "02",
    name: "Coin Bot",
    role: "Solana · DEX · Jupiter",
    color: "#69d5ec",
    icon: "₿",
  },
  {
    id: "aurum",
    level: "01",
    name: "AURUM",
    role: "Złoto i makro",
    color: "#e5bd70",
    icon: "Au",
  },
] as const;
export interface OfficeSnapshot {
  updatedAt: string;
  ideas: { title: string; status: string; next: string }[];
}
const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
const localTime = (date: string) =>
  new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(date));
const localDate = (date: string) =>
  new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(date));

function useMarkets() {
  const [markets, setMarkets] = useState<BiuroMarketsSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function load() {
      controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch("/api/biuro/markets", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data: BiuroMarketsSnapshot = await response.json();
        if (!disposed) {
          setMarkets(data);
          setState(response.ok && data.assets?.length ? "ready" : "error");
        }
      } catch {
        if (!disposed) setState("error");
      } finally {
        clearTimeout(deadline);
        if (!disposed) timer = setTimeout(load, 20000);
      }
    }
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [refresh]);
  return { markets, state, reload: () => setRefresh((n) => n + 1) };
}

function BrandMark() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 26V8l10-4 10 4v18M10 26V12l10-4v18M4 26h22"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m6 13 8-3m-8 9 8-3m-8 7 8-3m3-6 6 2m-6 4 6 2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

export function OfficeHQ({ snapshot }: { snapshot: OfficeSnapshot }) {
  const [selected, setSelected] = useState("hq");
  const [resetKey, setResetKey] = useState(0);
  const [clock, setClock] = useState("");
  const { markets, state, reload } = useMarkets();
  const floor = FLOORS.find((item) => item.id === selected) || FLOORS[0];
  useEffect(() => {
    const tick = () => setClock(localTime(new Date().toISOString()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const hasFreshMarkets =
    state === "ready" &&
    markets &&
    Date.now() - Date.parse(markets.asOf) < 90000;
  const connected = hasFreshMarkets
    ? markets.exchanges.filter((exchange) => exchange.status === "connected")
        .length
    : 0;
  const marketLabel =
    state === "loading"
      ? "Łączenie z rynkiem"
      : hasFreshMarkets
        ? "Notowania na żywo"
        : "Dane rynku niedostępne";

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <a
          href="/biuro"
          className={styles.brand}
          aria-label="BiuroHQ — budynek"
        >
          <span className={styles.brandIcon}>
            <BrandMark />
          </span>
          <span>
            Biuro<span className={styles.brandHQ}>HQ</span>
            <small>TWÓJ CYFROWY HOLDING</small>
          </span>
        </a>
        <nav className={styles.topNav} aria-label="Nawigacja biura">
          <button
            className={selected === "hq" ? styles.navActive : ""}
            onClick={() => setSelected("hq")}
          >
            Budynek
          </button>
          <button
            className={selected === "coin" ? styles.navActive : ""}
            onClick={() => setSelected("coin")}
          >
            Rynki
          </button>
          <a href="/biuro/desk">Raport paper ↗</a>
        </nav>
        <div className={styles.headerRight}>
          <span className={styles.clock}>
            {clock || "Europe/Warsaw"}
            <small>WARSZAWA</small>
          </span>
          <button
            className={styles.walletButton}
            onClick={() => {
              setSelected("coin");
              document
                .getElementById("wallet-panel")
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            <span className={styles.walletDiamond}>◇</span>Portfel bota
            <span>↗</span>
          </button>
          <div className={styles.avatar} title="Biuro Kuby">
            KW
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.introduction}>
          <div>
            <div className={styles.eyebrow}>
              <span />
              PRZESTRZEŃ TWOICH PROJEKTÓW
            </div>
            <h1>
              Cała firma. <em>Jeden adres.</em>
            </h1>
            <p>Każdy projekt ma swoje piętro. Ty masz pełny obraz.</p>
          </div>
          <div className={styles.marketSignal}>
            <span
              className={hasFreshMarkets ? styles.pulseDot : styles.offlineDot}
            />
            <div>
              {marketLabel}
              <small>
                {hasFreshMarkets
                  ? `${connected} źródła giełdowe · rynek krypto`
                  : "Coinbase + Kraken"}
              </small>
            </div>
          </div>
        </div>
        <div className={styles.workspace}>
          <aside className={styles.floorSidebar}>
            <div className={styles.sectionLabel}>
              TWÓJ BUDYNEK <span>03 PIĘTRA</span>
            </div>
            <div
              className={styles.floorList}
              role="group"
              aria-label="Wybierz piętro"
            >
              {FLOORS.map((item) => (
                <button
                  key={item.id}
                  data-testid={`floor-${item.id}`}
                  className={`${styles.floorButton} ${selected === item.id ? styles.floorSelected : ""}`}
                  onClick={() => setSelected(item.id)}
                  aria-pressed={selected === item.id}
                  style={{ "--floor-color": item.color } as React.CSSProperties}
                >
                  <span className={styles.floorLevel}>
                    {item.level}
                    <small>POZIOM</small>
                  </span>
                  <span className={styles.floorInfo}>
                    <strong>{item.name}</strong>
                    <small>
                      {getFloorInventory(item.id)?.counts.stations !== null
                        ? `${getFloorInventory(item.id)?.counts.stations} stanowisk · ${item.role}`
                        : item.role}
                    </small>
                  </span>
                  <span className={styles.floorArrow}>↗</span>
                </button>
              ))}
            </div>
            <div className={styles.sidebarNote}>
              <span>⌖</span>
              <p>
                Wybierz piętro na liście
                <br />
                lub bezpośrednio w budynku.
              </p>
            </div>
            <div className={styles.sourceSection}>
              <div className={styles.sectionLabel}>
                POŁĄCZENIA RYNKOWE
                <button
                  onClick={reload}
                  aria-label="Odśwież notowania"
                  title="Odśwież notowania"
                >
                  ↻
                </button>
              </div>
              {(["coinbase", "kraken"] as const).map((id) => {
                const exchange = markets?.exchanges.find((e) => e.id === id);
                const ok = hasFreshMarkets && exchange?.status === "connected";
                return (
                  <div key={id} className={styles.sourceRow}>
                    <span className={styles.exchangeIcon}>
                      {id === "coinbase" ? "C" : "K"}
                    </span>
                    <span>
                      {id === "coinbase" ? "Coinbase" : "Kraken"}
                      <small>Publiczne notowania</small>
                    </span>
                    <span className={ok ? styles.sourceLive : styles.sourceOff}>
                      {ok
                        ? "● Online"
                        : state === "loading"
                          ? "…"
                          : "○ Offline"}
                    </span>
                  </div>
                );
              })}
              <p className={styles.sourceNote}>
                Status dotyczy danych rynku. Bot i portfel mają osobne
                połączenia.
              </p>
            </div>
          </aside>
          <section
            className={styles.sceneSection}
            aria-label="Interaktywny budynek BiuroHQ"
          >
            <button
              className={styles.resetButton}
              onClick={() => setResetKey((n) => n + 1)}
              title="Przywróć widok budynku"
              aria-label="Przywróć widok budynku"
            >
              ⤢
            </button>
            <div className={styles.sceneCanvas}>
              <BuildingScene
                selectedFloor={selected}
                onSelectFloor={setSelected}
                resetKey={resetKey}
                structure={BIURO_STRUCTURE.floors}
              />
            </div>
            <div className={styles.sceneCaption}>
              <span className={styles.captionLine} />
              <span>
                {floor.level} / <strong>{floor.name}</strong>
              </span>
              <span className={styles.sceneHint}>WYBIERZ SWOJE PIĘTRO</span>
            </div>
            <div className={styles.tickerStrip}>
              {(["BTC", "ETH", "SOL"] as const).map((symbol) => {
                const asset = markets?.assets.find(
                  (item) => item.symbol === symbol,
                );
                return (
                  <div className={styles.ticker} key={symbol}>
                    <span
                      className={
                        symbol === "BTC"
                          ? styles.bitcoinIcon
                          : styles.ethereumIcon
                      }
                    >
                      {symbol === "BTC" ? "₿" : symbol === "ETH" ? "Ξ" : "◎"}
                    </span>
                    <span className={styles.tickerAsset}>
                      {symbol}
                      <small>
                        {symbol === "BTC"
                          ? "Bitcoin"
                          : symbol === "ETH"
                            ? "Ethereum"
                            : "Solana"}
                      </small>
                    </span>
                    <span className={styles.tickerValue}>
                      {asset ? usd(asset.priceUsd) : "—"}
                      <small>
                        {asset
                          ? `${hasFreshMarkets ? asset.source : "Ostatni odczyt"} · ${localTime(asset.observedAt)}`
                          : state === "loading"
                            ? "Pobieranie…"
                            : "Brak odczytu"}
                      </small>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <aside
            className={styles.details}
            aria-label={`Panel piętra ${floor.name}`}
          >
            <div className={styles.detailHeader}>
              <span
                className={styles.detailIcon}
                style={{ color: floor.color, background: `${floor.color}15` }}
              >
                {floor.icon}
              </span>
              <div>
                <span className={styles.eyebrow}>POZIOM {floor.level}</span>
                <h2>{floor.name}</h2>
              </div>
              <span className={styles.detailMenu}>···</span>
            </div>
            {selected === "hq" && (
              <>
                <p className={styles.detailIntro}>
                  Jedno miejsce do nadzoru nad projektami, rynkiem i kolejnymi
                  pomysłami.
                </p>
                <div className={styles.overviewStats}>
                  <div>
                    <strong>02</strong>
                    <span>projekty</span>
                  </div>
                  <div>
                    <strong>03</strong>
                    <span>piętra</span>
                  </div>
                  <div>
                    <strong>{String(connected).padStart(2, "0")}</strong>
                    <span>źródła online</span>
                  </div>
                </div>
                <div className={styles.cardTitle}>
                  <h3>Na poszczególnych piętrach</h3>
                </div>
                <div className={styles.projectRows}>
                  {FLOORS.slice(1).map((item) => (
                    <button key={item.id} onClick={() => setSelected(item.id)}>
                      <span style={{ color: item.color }}>{item.icon}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>
                          {item.id === "coin"
                            ? "Solana DEX · dane rynku"
                            : item.id === "aurum"
                              ? "Terminal makro i geopolityka"
                              : `${snapshot.ideas.length} karty pomysłów w raporcie`}
                        </small>
                      </div>
                      <b>↗</b>
                    </button>
                  ))}
                </div>
                <div className={styles.snapshotNote}>
                  <span>◷</span>
                  <p>
                    Raport paper Cursor/Origin to zapis z{" "}
                    <strong>{localDate(snapshot.updatedAt)}</strong>. To oddzielny
                    projekt BTC/ETH; nie przedstawia salda bota Solana.
                  </p>
                </div>
              </>
            )}
            {selected === "coin" && (
              <>
                <p className={styles.detailIntro}>
                  Coin Bot korzysta z Solany, DEX-ów i Jupiter. Poniżej niezależne
                  notowania rynku spot i par on-chain w jednym miejscu.
                </p>
                <div className={styles.cardTitle}>
                  <h3>Rynek spot · USD</h3>
                  <span
                    className={
                      hasFreshMarkets ? styles.livePill : styles.neutralPill
                    }
                  >
                    {hasFreshMarkets ? "Dane live" : "Brak danych live"}
                  </span>
                </div>
                <div className={styles.marketCards}>
                  {(["BTC", "ETH", "SOL", "DOGE", "XRP", "LINK"] as const).map(
                    (symbol) => {
                      const asset = markets?.assets.find(
                        (item) => item.symbol === symbol,
                      );
                      return (
                        <div key={symbol}>
                          <span>
                            {symbol}
                            <small>{asset?.source || "Giełda"}</small>
                          </span>
                          <strong>{asset ? usd(asset.priceUsd) : "—"}</strong>
                        </div>
                      );
                    },
                  )}
                </div>
                <div className={styles.connectionChecklist}>
                  <div>
                    <span
                      className={
                        hasFreshMarkets ? styles.sourceLive : styles.muted
                      }
                    >
                      ●
                    </span>
                    Notowania giełdowe
                    <strong>
                      {hasFreshMarkets ? "Połączone" : "Niedostępne"}
                    </strong>
                  </div>
                  <div>
                    <span className={styles.muted}>◇</span>Portfel bota
                    <strong>Solana · serwer</strong>
                  </div>
                  <div>
                    <span className={styles.warningDot}>○</span>Odczyt instancji
                    w HQ<strong>Do synchronizacji</strong>
                  </div>
                </div>
                <p className={styles.sourceNote}>
                  Coinbase i Kraken dostarczają tu publiczne ceny. Nie łączą
                  silnika bota z tymi giełdami. Jego ścieżka wykonawcza pozostaje
                  na Solanie.
                </p>
              </>
            )}
            {selected === "aurum" && (
              <>
                <p className={styles.detailIntro}>
                  Twoje piętro złota. Makroekonomia, geopolityka i kontekst
                  rynku w terminalu AURUM.
                </p>
                <div className={styles.aurumCard}>
                  <span>Au</span>
                  <div>
                    <strong>Gold intelligence</strong>
                    <small>Makro · geopolityka · mapa</small>
                  </div>
                  <div className={styles.aurumLines}>
                    {Array.from({ length: 8 }, (_, i) => (
                      <i key={i} />
                    ))}
                  </div>
                </div>
                <a
                  className={styles.primaryButton}
                  href={AURUM_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Otwórz terminal AURUM<span>↗</span>
                </a>
                <a
                  className={styles.textLink}
                  href="https://github.com/kubawitek132-rgb/aurum-gold-terminal/actions"
                  target="_blank"
                  rel="noreferrer"
                >
                  Kod i status budowania<span>↗</span>
                </a>
                <div className={styles.snapshotNote}>
                  <span>↗</span>
                  <p>
                    AURUM otwiera się pod własnym adresem. BiuroHQ pozostaje
                    centralą projektów.
                  </p>
                </div>
              </>
            )}
            <FloorInventory inventory={getFloorInventory(selected)} />
            {selected === "coin" && <CoinExplorer />}
            <div className={styles.detailDivider} />
            <BotWalletPanel />
          </aside>
        </div>
        <footer className={styles.footer}>
          <span>
            <span className={styles.footerMark}>▥</span> BiuroHQ{" "}
            <span className={styles.footerDivider}>/</span> Zbudowane wokół
            Twoich projektów
          </span>
          <span>
            RYNEK KRYPTO ·{" "}
            {hasFreshMarkets ? "DANE RYNKU LIVE" : "OCZEKIWANIE NA DANE"}
            <span className={styles.footerDivider}>/</span> WARSZAWA
          </span>
        </footer>
      </main>
    </div>
  );
}

function FloorInventory({ inventory }: { inventory?: BiuroFloorInventory }) {
  if (!inventory) return null;
  const unknown = inventory.counts.stations === null;
  return (
    <section
      className={styles.inventory}
      aria-label="Rzeczywista struktura biura"
    >
      <div className={styles.cardTitle}>
        <h3>Stanowiska i działy</h3>
        <span className={unknown ? styles.neutralPill : styles.livePill}>
          {unknown ? "Brak rejestru" : "Sprawdzony wykaz"}
        </span>
      </div>
      <div className={styles.inventoryCounts}>
        <div>
          <strong>{inventory.counts.stations ?? "—"}</strong>
          <span>stanowisk w wykazie</span>
        </div>
        <div>
          <strong>{inventory.id === "aurum" ? "16 + 6" : "—"}</strong>
          <span>
            {inventory.id === "aurum"
              ? "działów + sekcji biura"
              : "odrębne działy"}
          </span>
        </div>
      </div>
      <p className={styles.sourceNote}>
        {inventory.sourceLabel}
        {inventory.verifiedAt
          ? ` · odczyt ${localDate(inventory.verifiedAt)}`
          : ""}
      </p>
      {unknown ? (
        <p className={styles.sourceNote}>
          Nie dodajemy fikcyjnych stanowisk. Odrębny wykaz HQ nie został jeszcze
          potwierdzony.
        </p>
      ) : (
        <>
          <details className={styles.inventoryDetails}>
            <summary>
              Zobacz wszystkie role ({inventory.counts.stations}){" "}
              <span>＋</span>
            </summary>
            <div className={styles.departmentList}>
              {inventory.departments.map((department) => (
                <div key={department.id}>
                  <h4>
                    {department.name}
                    <span>{department.stations.length}</span>
                  </h4>
                  <ul>
                    {department.stations.map((station) => (
                      <li key={station.id}>
                        <span>{station.name}</span>
                        {station.role && <small>{station.role}</small>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
          <p className={styles.sourceNote}>
            {inventory.id === "aurum"
              ? "20 ról biura i 41 stanowisk Sentinela. Research oraz laboratorium są częścią AURUM."
              : "12 ról istniejącego bota. Wykaz nie określa liczby osobnych działów."}{" "}
            Liczba stanowisk nie oznacza liczby aktualnie pracujących procesów.
          </p>
        </>
      )}
    </section>
  );
}
