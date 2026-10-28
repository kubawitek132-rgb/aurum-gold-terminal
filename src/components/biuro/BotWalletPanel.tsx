import styles from './OfficeHQ.module.css';

/** Existing Coin Bot wallet context, without wallet requests or account access. */
export function BotWalletPanel() {
  return <section className={styles.walletPanel} id="wallet-panel" aria-label="Portfel bota Phantom">
    <div className={styles.cardTitle}><h3>Phantom</h3><span className={styles.neutralPill}>Portfel bota</span></div>
    <p className={styles.smallText}>Istniejące połączenie z Coin Botem jest zachowane.</p>
    <p className={styles.walletNote}>HQ nie zmienia portfela ani jego uprawnień. Saldo i transakcje pozostają w terminalu bota.</p>
  </section>;
}
