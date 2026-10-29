# BiuroHQ building

`/biuro` is the three-floor HQ interface. The `biurohq.com` host still rewrites `/` to this route; other domains retain their original AURUM root. The original report remains available at `/biuro/desk` and `/biuro.html`.

The Three.js scene consumes the same typed inventory as the visible workstation list. One source role produces one workstation. There are no decorative staff or desks added to the counts. Floors, bottom to top: AURUM, Coin Bot, BiuroHQ.

Inventory was read on 28 October 2026, 09:30 UTC:

- AURUM Office `aurum-office-20261027-v23`: 20 named roles in 6 office sections, plus 41 installed Sentinel registry positions in 16 operational departments. The installed manifest matched `core.py` and `static/scene.js`. These are 22 source groups, not a claim of 22 independent departments.
- Coin Bot: 12 logical role headings in the interface of one trading bot. This confirms its role list, not 12 separate bots, registered departments or current worker health.
- HQ: no independently confirmed roster. Counts stay null, with no fabricated workstations.
- Research and SASZA's laboratory belong to AURUM. The staged FIEDIA role is not in the installed v23 core and is excluded.

Role definitions do not certify running processes, available AI models, qualified strategies or trading permissions. Source names, counts and timestamps are in `src/lib/biuroStructure.ts`. No private infrastructure addresses, wallet balances, account addresses, transactions or credentials are published in this inventory.

Coin Bot BTC/ETH on the Biuro desk is live through MetaMask: real buy and sell, under risk limits (5000 USD, 2% daily drawdown, kill-switch). Paper is only the fallback before that wallet is connected, not the desk's main status. A separate Solana DEX/Jupiter server path is architecture context, not the headline.

The public desk states live MetaMask for BTC/ETH and can show a browser wallet preview. It does not store keys. Paper fills in the snapshot are the fallback log from before that connection, not the main desk status.

The market endpoint and token explorer provide public data independently of either bot. Coinbase/Kraken price feeds do not connect the Solana bot to those exchanges. See `biuro-exchanges.md`. Authenticated bot telemetry and execution are not provided by this public UI.
