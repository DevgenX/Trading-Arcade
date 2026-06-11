# Trading Arcade

Trading Arcade is a guest-first browser game built from seeded historical crypto candles. It ships as a frontend-only arcade build: no login wall, no required API keys, no Mongo dependency, and replayable runs driven by local JSON seed data.

## What ships in v1

- `Daily Run`, `AI Battle`, and `Free Play` modes
- Deterministic seed URLs for replay and sharing
- Guest profile, unlocks, and stats stored in `localStorage`
- Four explainable non-LLM bot personalities: `Ape`, `Scalper`, `Mean Reverter`, `Diamond Hands`
- Custom in-app chart renderer using the bundled candle data

## Local setup

Requirements:

- Node.js 18+
- npm 9+

Install and run:

```bash
npm install
npm start
```

Build and test:

```bash
npm test
npm run build
```

The app runs entirely from the client workspace. No `.env` values are required for the default local experience.

## Open-source notes

- The public build does not depend on `MONGO_URL`, `JWT_SECRET`, or `JWT_LIFETIME`.
- Legacy auth, profile, tournament, challenge, and TradingView charting surfaces were removed from the shipped runtime path.
- Replay state and player progression are stored locally in the browser.
