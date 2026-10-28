# BiuroHQ building

`/biuro` is the three-floor HQ interface. The `biurohq.com` host still rewrites `/` to this route; other domains retain their original AURUM root. The original report remains available at `/biuro/desk` and `/biuro.html`.

The Three.js scene consumes the same typed inventory as the visible workstation list. One source role produces one workstation. There are no decorative staff or desks added to the counts. Floors, bottom to top: AURUM, Coin Bot, BiuroHQ.

Inventory was read on 28 October 2026, 09:30 UTC:

- AURUM Office `aurum-office-20261027-v23`: 20 named roles in 6 office sections, plus 41 installed Sentinel registry positions in 16 operational departments. The installed manifest matched `core.py` and `static/scene.js`. These are 22 source groups, not a claim of 22 independent departments.
- Coin Bot: 12 logical role headings in the interface of one trading bot. This confirms its role list, not 12 separate bots, registered departments or current worker health.
- HQ: no independently confirmed roster. Counts stay null, with no fabricated workstations.
- Research and SASZA's laboratory belong to AURUM. The staged FIEDIA role is not in the installed v23 core and is excluded.

Role definitions do not certify running processes, available AI models, qualified strategies or trading permissions. Source names, counts and timestamps are in `src/lib/biuroStructure.ts`. No private infrastructure addresses, wallet balances, account addresses, transactions or credentials are published in this inventory.

The complete source conversation distinguishes the existing Solana Coin Bot from the separate Cursor/Origin BTC/ETH paper project. The Solana bot uses DEXes/Jupiter and a separate signing wallet on its server. Phantom was the initial browser wallet and later funded that separate wallet; it is not the bot's current signing environment. Wrapped BTC/ETH quotes on Solana do not establish native Bitcoin or Ethereum execution.

HQ displays this architectural context only. It does not connect a wallet, inspect browser accounts, read private balances, or request signatures. Balances and transactions remain in the bot terminal. The public panel does not verify current execution or private wallet health. A saved MetaMask CLI credential in the separate project is not evidence of authenticated execution.

The market endpoint and token explorer provide public data independently of either bot. Coinbase/Kraken price feeds do not connect the Solana bot to those exchanges. See `biuro-exchanges.md`. Authenticated bot telemetry and execution are not provided by this public UI.
