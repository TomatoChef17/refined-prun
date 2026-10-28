# Refined PrUn – COSM Edition

Refined PrUn with extra burn, supply, contract and market tools for Prosperous Universe.
Made by COSM players, for everyone.

- Chrome: [Chrome Web Store](https://chromewebstore.google.com/detail/mdophejiplinnkjobdegcmholpimaflo)
- Firefox: [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/refined-prun-cosm-edition/)
- What changed: [COSM-CHANGELOG.md](COSM-CHANGELOG.md)
- [Privacy policy](PRIVACY.md)

## Safe by design

One click = one game action. COSM Edition never transfers, buys or sends anything on its own.
New features must follow this rule (see `docs/contributing.md`, "Server Communication & ToS").

## Building

Install [Node.js](https://nodejs.org/) 22 and [pnpm](https://pnpm.io/). Then, in the repository root:

```
pnpm install
pnpm build
```

The extension is built in the `dist` folder. Load it in `chrome://extensions` with
"Load unpacked" (developer mode on).

## Contributing

1. Fork this repository and create a branch from `cosm-edition`.
2. Read `AGENTS.md` and `docs/` (feature patterns, style rules).
3. Before a pull request, run `pnpm run compile` and `pnpm exec vitest run --dir src`.
4. Add a line for your change in `COSM-CHANGELOG.md` under a new version.

## About this edition

COSM Edition is an independent edition based on the open-source
[Refined PrUn](https://github.com/refined-prun/refined-prun) (MIT license). It is maintained by COSM
players and is not made by the Refined PrUn authors or by Simulogics. The original copyright notices
are kept in [LICENSE](LICENSE).
