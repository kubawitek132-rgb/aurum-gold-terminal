"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  chainLabel,
  formatWalletBalance,
  nativeSymbol,
  walletAccounts,
  walletChain,
  walletError,
  type WalletProvider,
} from "@/lib/biuroWallet";
import styles from "./OfficeHQ.module.css";

interface Announcement extends Event {
  detail: { info: { rdns: string }; provider: WalletProvider };
}
type EthereumWindow = Window & { ethereum?: WalletProvider };

export function MetaMaskWallet({ compact = false }: { compact?: boolean }) {
  const provider = useRef<WalletProvider | null>(null);
  const subscription = useRef<(() => void) | null>(null);
  const requestVersion = useRef(0);
  const actionVersion = useRef(0);
  const busyRef = useRef(false);
  const refreshingRef = useRef(false);
  const [available, setAvailable] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chain, setChain] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceAt, setBalanceAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (p: WalletProvider, accounts?: unknown) => {
    if (provider.current !== p) return;
    const version = ++requestVersion.current;
    const current = () =>
      version === requestVersion.current && provider.current === p;
    refreshingRef.current = true;
    setRefreshing(true);
    setError("");
    setBalance(null);
    setBalanceAt(null);
    try {
      const addresses = walletAccounts(
        accounts ?? (await p.request({ method: "eth_accounts" })),
      );
      if (!current()) return;
      setAccount(addresses[0] || null);
      if (!addresses.length) {
        setChain(null);
        return;
      }
      const chainId = walletChain(await p.request({ method: "eth_chainId" }));
      if (!current()) return;
      setChain(chainId);
      if (!chainId) throw new Error("Invalid wallet chain");
      const value = await p.request({
        method: "eth_getBalance",
        params: [addresses[0], "latest"],
      });
      if (!current()) return;
      const formatted = formatWalletBalance(value);
      if (formatted === null) throw new Error("Invalid wallet balance");
      setBalance(formatted);
      setBalanceAt(new Date().toISOString());
    } catch (e) {
      if (current()) setError(walletError(e));
    } finally {
      if (current()) {
        refreshingRef.current = false;
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let selectedByAnnouncement = false;
    const choose = (p: WalletProvider, announced: boolean) => {
      if (!p || typeof p.request !== "function") return;
      if (provider.current === p) {
        selectedByAnnouncement ||= announced;
        return;
      }
      // An EIP-6963 MetaMask announcement can replace an earlier legacy fallback.
      // isMetaMask alone is also set by some other browser wallets.
      if (provider.current && (!announced || selectedByAnnouncement)) return;
      subscription.current?.();
      requestVersion.current++;
      actionVersion.current++;
      selectedByAnnouncement = announced;
      provider.current = p;
      busyRef.current = false;
      setBusy(false);
      setAccount(null);
      setChain(null);
      setBalance(null);
      setBalanceAt(null);
      setAvailable(true);
      const accountsChanged = (...args: unknown[]) => {
        void refresh(p, args[0]);
      };
      const chainChanged = () => {
        void refresh(p);
      };
      const disconnected = () => {
        if (provider.current !== p) return;
        requestVersion.current++;
        refreshingRef.current = false;
        setRefreshing(false);
        setAccount(null);
        setBalance(null);
        setBalanceAt(null);
        setChain(null);
      };
      p.on?.("accountsChanged", accountsChanged);
      p.on?.("chainChanged", chainChanged);
      p.on?.("disconnect", disconnected);
      subscription.current = () => {
        p.removeListener?.("accountsChanged", accountsChanged);
        p.removeListener?.("chainChanged", chainChanged);
        p.removeListener?.("disconnect", disconnected);
      };
      // Read previously granted accounts only. No permission prompt on page load.
      void refresh(p);
    };
    const announced = (event: Event) => {
      const detail = (event as Partial<Announcement>).detail;
      if (detail?.info?.rdns === "io.metamask") choose(detail.provider, true);
    };
    window.addEventListener("eip6963:announceProvider", announced);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const fallbackTimer = window.setTimeout(() => {
      if (selectedByAnnouncement) return;
      const injected = (window as EthereumWindow).ethereum;
      const fallback =
        injected?.providers?.find((p) => p.isMetaMask) ||
        (injected?.isMetaMask ? injected : null);
      if (fallback) choose(fallback, false);
    }, 350);
    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("eip6963:announceProvider", announced);
      subscription.current?.();
      subscription.current = null;
      provider.current = null;
      requestVersion.current++;
      actionVersion.current++;
    };
  }, [refresh]);

  useEffect(() => {
    if (compact || !account) return;
    const updateVisible = () => {
      const p = provider.current;
      if (
        document.visibilityState === "visible" &&
        p &&
        !busyRef.current &&
        !refreshingRef.current
      )
        void refresh(p);
    };
    const interval = window.setInterval(updateVisible, 30_000);
    document.addEventListener("visibilitychange", updateVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateVisible);
    };
  }, [account, compact, refresh]);

  async function connect() {
    const p = provider.current;
    if (!p || busyRef.current) return;
    const version = ++actionVersion.current;
    const current = () =>
      actionVersion.current === version && provider.current === p;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await p.request({ method: "eth_requestAccounts" });
      if (current()) await refresh(p);
    } catch (e) {
      if (current()) setError(walletError(e));
    } finally {
      if (current()) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  async function disconnect() {
    const p = provider.current;
    if (!p || busyRef.current) return;
    const version = ++actionVersion.current;
    const current = () =>
      actionVersion.current === version && provider.current === p;
    busyRef.current = true;
    requestVersion.current++;
    refreshingRef.current = false;
    setRefreshing(false);
    setBusy(true);
    setError("");
    try {
      await p.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
      if (!current()) return;
      requestVersion.current++;
      setAccount(null);
      setBalance(null);
      setBalanceAt(null);
      setChain(null);
      refreshingRef.current = false;
      setRefreshing(false);
    } catch {
      if (current())
        setError(
          "Nie udało się rozłączyć. Usuń połączenie biurohq.com w MetaMask.",
        );
    } finally {
      if (current()) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  function refreshBalance() {
    const p = provider.current;
    if (p && !busyRef.current && !refreshingRef.current) void refresh(p);
  }

  if (compact)
    return (
      <button
        className={styles.walletButton}
        onClick={() =>
          document
            .getElementById("wallet-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      >
        <span className={styles.walletDiamond}>◇</span>
        {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "MetaMask"}
        <span>↗</span>
      </button>
    );

  return (
    <section
      className={styles.walletPanel}
      id="wallet-panel"
      aria-label="Portfel MetaMask"
    >
      <div className={styles.cardTitle}>
        <span className={styles.walletDiamond}>◇</span>
        <h3>Podgląd MetaMask</h3>
        <span className={account ? styles.livePill : styles.neutralPill}>
          {account ? "Połączony" : "MetaMask"}
        </span>
      </div>
      {account ? (
        <>
          <div className={styles.walletAddress} title={account}>
            {account.slice(0, 10)}…{account.slice(-8)}
          </div>
          <div className={styles.walletBalance}>
            {balance ?? "—"} <small>{nativeSymbol(chain)}</small>
          </div>
          <p className={styles.muted}>{chainLabel(chain)} · saldo z portfela</p>
          <p className={styles.muted}>
            {balanceAt ? (
              <>
                Odczyt:{" "}
                <time dateTime={balanceAt}>
                  {new Date(balanceAt).toLocaleTimeString("pl-PL", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>{" "}
                · co 30 s
              </>
            ) : refreshing ? (
              "Odczytywanie salda…"
            ) : (
              "Brak aktualnego odczytu salda"
            )}
          </p>
          <button
            type="button"
            className={styles.textLink}
            disabled={busy || refreshing}
            onClick={refreshBalance}
          >
            {refreshing ? "Odświeżanie…" : "Odśwież saldo"}
          </button>
          <button
            className={styles.secondaryButton}
            disabled={busy}
            onClick={disconnect}
          >
            {busy ? "Rozłączanie…" : "Rozłącz ten podgląd"}
          </button>
        </>
      ) : (
        <>
          <p className={styles.smallText}>
            Podgląd portfela w tej przeglądarce: adres, sieć i saldo.
          </p>
          {available ? (
            <button
              className={styles.primaryButton}
              onClick={connect}
              disabled={busy}
            >
              {busy ? "Otwórz MetaMask…" : "Połącz MetaMask"}
              <span>↗</span>
            </button>
          ) : (
            <a
              className={styles.primaryButton}
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
            >
              Otwórz MetaMask<span>↗</span>
            </a>
          )}
        </>
      )}
      {error && (
        <p role="alert" className={styles.errorText}>
          {error}
        </p>
      )}
      <p className={styles.walletNote}>
        Ten podgląd nie zmienia portfela podłączonego do bota. Odczytuje konto
        udostępnione przez MetaMask w tej przeglądarce.
      </p>
    </section>
  );
}
