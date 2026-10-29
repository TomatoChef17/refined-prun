# Refined PrUn — COSM Fork

This repository is the **COSM-specific fork** of the original **Refined PrUn (rPrUn)** project.

## 🚀 Developer Onboarding

Welcome! Before contributing, please familiarize yourself with our branching strategy, development roadmap, and contribution guidelines.

### 🌿 Branching Strategy

We maintain two development branches to keep general improvements separate from COSM-specific functionality:

| Branch | Purpose |
|---|---|
| `dev` | General-purpose features and improvements applicable to the upstream Refined PrUn project. |
| `dev-cosm` | COSM-specific features, customizations, and integrations. |

**Contribution targets**

- **General improvements:** Fork from and submit pull requests to `dev`, not `dev-cosm`.
- **COSM-specific features:** Target `dev-cosm` for functionality exclusive to COSM. Recommend to add cosm tag before feature name, for example `yuki/wip-cosm-punoted-auto-buy`

**Feature branch naming and lifecycle**

- Create feature work in a personal branch:
  - `{author-id}/{optional:wip}-{feature-name}`
  - Example: `tomato/wip-market-filters`, `moon/ui-density-tweaks`
- Keep these feature branches after merge when the feature is still waiting for upstream adoption in official rPrUn.
- Delete these open feature branches only after the same feature is adopted in both:
  - Official rPrUn
  - COSM fork (`dev` / `dev-cosm`)
- It is recommended but not forced that you keep a clean git history with 1-feature-1-commit principle.



**Maintenance ownership**

- **Tomato** owns deviation control between `dev` and official rPrUn:
  - Import official updates back into COSM when needed.
  - Use inbound tracking branches named:
    - `tomato/official-inbound-{feature-name}`
  - Clean up open feature branches after adoption is complete in both repos.
- **Yuki** and **Moon** import required, safe OOG features into `dev`:
  - `yuki/oog-inbound-{feature-name}`
  - `moon/oog-inbound-{feature-name}`

**Guiding principle**

Keep divergence low at all times:

1. Keep `dev` closely aligned with the upstream Refined PrUn project.
2. Keep `dev-cosm` as close to `dev` as possible, with only COSM-specific deltas.

This process reduces merge conflicts and keeps synchronization with official rPrUn predictable.

### 📚 Getting Started

Before making your first contribution, please review the following documentation:

| Document | Description |
|---|---|
| [`docs/roadmap.md`](docs/roadmap.md) | Project roadmap, development priorities, and planned features. |
| [`docs/contributing.md`](docs/contributing.md) | Contribution guidelines and principles inherited from the upstream project. |
| [`docs/README.md`](docs/README.md) | Documentation index and overview of additional resources. |

---

**💡 Keep it upstream-friendly.** Whenever possible, design features to be reusable and compatible with the original Refined PrUn project. COSM-specific changes should remain clearly isolated to simplify future maintenance and synchronization.

<!-- [link-chrome]: https://chromewebstore.google.com/detail/refined-prun/coabeheneafgglpakallmkienlidgaof 'Version published on Chrome Web Store'

[link-firefox]: https://addons.mozilla.org/en-US/firefox/addon/refined-prun/ 'Version published on Mozilla Add-ons'

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/chrome/chrome.svg" width="32" alt="Chrome" valign="middle">][link-chrome] [<img valign="middle" src="https://img.shields.io/chrome-web-store/v/coabeheneafgglpakallmkienlidgaof.svg?label=%20">][link-chrome]
[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/firefox/firefox.svg" width="32" alt="Firefox" valign="middle">][link-firefox] [<img valign="middle" src="https://img.shields.io/amo/v/refined-prun.svg?label=%20">][link-firefox]

Browser extension that simplifies the Prosperous Universe interface and adds useful features

## Highlights 🔥

<table>
	<tr>
		<th width="50%">
			<p>Pending Contract Conditions
			<p><img src="https://github.com/user-attachments/assets/21e219dd-5923-4a47-831a-3eb527e99f8d">
		<th width="50%">
			<p>Commodity Exchange Trades
			<p><img src="https://github.com/user-attachments/assets/b0139e1e-153a-4fc7-b88a-f2954add66bf">
	<tr>
		<th width="50%">
			<p>Detailed Balance Statement
			<p><img src="https://github.com/user-attachments/assets/f0452cf4-2a18-4336-a2f7-0b03ba6ef941">
		<th width="50%">
			<p>HQ Upgrade Calculator
			<p><img src="https://github.com/user-attachments/assets/3a514d76-85b5-4b58-ba5c-2a1a52a8deff">
	<tr>
		<th width="50%">
			<p>CONTD partner search results are shown above the search bar
			<p><img src="https://github.com/user-attachments/assets/2e9864e4-e13f-4f06-893b-701d9687dbf9">
		<th width="50%">
			<p>SHPT and BLCK destination labels
			<p><img src="https://github.com/user-attachments/assets/d1c2f806-1b14-4a27-b5a7-1466c9dcaee9">
	<tr>
		<th width="50%">
			<p>Better LM ads
			<p><img src="https://github.com/user-attachments/assets/a33aae8a-972b-4ac5-8389-361f71231250">
		<th width="50%">
			<p>Improved monochrome icon set
			<p><img src="https://github.com/user-attachments/assets/9fc42ef8-e2c6-43e9-8797-56601389205e">
</table>

---

## In-game preview

<img width="1920" alt="Screenshot 2024-11-17 at 21 54 03" src="https://github.com/user-attachments/assets/ed442f0e-297e-4f62-b539-7057e4a3b30f">

## Building

To build this extension, you will need to install [pnpm](https://pnpm.io/) v11.x

Then, in the repository root, run

```
pnpm install
pnpm build
```

The extension will be built in the `dist` folder -->
