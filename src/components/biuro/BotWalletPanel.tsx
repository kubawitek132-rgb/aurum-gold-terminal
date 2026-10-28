import styles from './OfficeHQ.module.css';

/** Documented Coin Bot wallet architecture, without live account access. */
export function BotWalletPanel() {
  return <section className={styles.walletPanel} id="wallet-panel" aria-label="Portfel bota Solana">
    <div className={styles.cardTitle}><h3>Portfel bota · Solana</h3><span className={styles.neutralPill}>Serwer</span></div>
    <p className={styles.smallText}>Oddzielny portfel na serwerze. Phantom służył do zasilenia.</p>
    <p className={styles.walletNote}>HQ nie podpisuje transakcji. Saldo i transakcje pozostają w terminalu bota.</p>
  </section>;
}
