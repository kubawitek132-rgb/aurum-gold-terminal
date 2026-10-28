# BiuroHQ building

`/biuro` is the three-floor HQ interface. The `biurohq.com` host still rewrites `/` to this route; other domains retain their original AURUM root. The original report remains available at `/biuro/desk` and `/biuro.html`.

The Three.js scene consumes the same typed inventory as the visible workstation list. One source role produces one workstation. There are no decorative staff or desks added to the counts. Floors, bottom to top: AURUM, Coin Bot, BiuroHQ.

Inventory was read on 28 October 2026, 09:30 UTC:

- AURUM Office `aurum-office-20261027-v23`: 20 named roles in 6 office sections, plus 41 installed Sentinel registry positions in 16 operational departments. The installed manifest matched `core.py` and `static/scene.js`. These are 22 source groups, not a claim of 22 independent departments.
- Coin Bot: 12 role headings in its existing office interface. This confirms its role list, not 12 separately registered departments or current worker health.
- HQ: no independently confirmed roster. Counts stay null, with no fabricated workstations.
- Research and SASZA's laboratory belong to AURUM. The staged FIEDIA role is not in the installed v23 core and is excluded.

Role definitions do not certify running processes, available AI models, qualified strategies or trading permissions. Source names, counts and timestamps are in `src/lib/biuroStructure.ts`. No private infrastructure addresses, wallet balances, account addresses, transactions or credentials are published in this inventory.

Coin Bot retains its existing Phantom connection, as confirmed by the owner. HQ displays this context only: it does not connect or reconnect a wallet, inspect browser accounts, read balances, or request permissions or signatures. Balances and transactions remain in the bot terminal. This public panel does not verify the current health of the private wallet connection.

The market endpoint and token explorer provide real public data, not bot execution telemetry. See `biuro-exchanges.md`. Authenticated bot telemetry and execution are not provided by this public UI.
