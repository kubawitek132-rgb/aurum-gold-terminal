import styles from './OfficeHQ.module.css';

/** Coin Bot desk status: live MetaMask for BTC/ETH. Paper is only the unconnected fallback. */
export function BotWalletPanel() {
  return <section className={styles.walletPanel} id="wallet-panel" aria-label="Coin Bot live MetaMask">
    <div className={styles.cardTitle}><h3>Coin Bot · live MetaMask</h3><span className={styles.neutralPill}>BTC/ETH</span></div>
    <p className={styles.smallText}>Realne kupno i sprzedaż BTC/ETH przez MetaMask. Risk: 5000 USD, 2% DD, kill-switch. Paper jest fallbackiem, zanim portfel jest podłączony.</p>
    <p className={styles.walletNote}>Klucze nie leżą w tym repo. Osobna ścieżka Solana na serwerze nie jest głównym statusem desku.</p>
  </section>;
}
