# COSM Edition Changelog

## 26.10.69

### Changed

- New store summary and description. No change in the features

## 26.10.68

### New

- `XIT SET`: New COSM tab. Choose your home station (warehouse and exchange), your SFC destination shortcuts and the ACT auto-close
- `CXPO`: Quick price buttons: one tick under the best ask (SELL) or over the best bid (BUY). Your own orders are ignored, and a red button warns when the price trades at once (`cxpo-quick-price`)
- `XIT SUPPLY`: BUY JSON button: one BUY contract for the checked missing inputs, delivered to your home station. Paste it in the CONTD import box
- `CONTD`: Add several commodity rows in one click (`contd-add-rows`)
- `SFC`: Your own destination shortcut buttons under the destination field (`sfc-custom-destinations`)
- `SHPI`: LM context button for the local market where the ship is landed (`shpi-lm-button`)
- `NOTS`: A click on a "CoGC program changed" notification opens the CoGC buffer with the vote (`nots-cogc-program-changed`)
- Shift-click opens related buffers side by side: `PRODQ` + `PRODCO` from the Queue or Order button in `PROD`, `POPID` next to `POPI`, and a notification target next to `NOTS` (`shift-click-companions`)
- `XIT ACT`: A floating action package window closes by itself after a clean run. It stays open after an error, a skipped step or a cancel

### Changed

- `INV`: Your open sell orders now show under the warehouse of every exchange station, not only Hortus (`inv-war-cx-sell-orders`)
- `XIT BURN` and `XIT SUPPLY`: The warehouse column follows your home station instead of Hortus only
- `XIT CONTS`: Long Item, Partner and Self cells show 3 entries and a "+N more" link

## 26.10.67

### New

- First public release of Refined PrUn – COSM Edition
- `XIT SUPPLY`: What every base needs compared with your warehouse stock
- `XIT BURN`: Days All, warehouse stock, amount to buy, inbound contracts and partner ships, resizable columns, A–Z sort
- `CONTD`: Favorite recipients sorted by contracts, top partner next to the recipient field, synced between your devices
- `INV`: IN / CON / IN+C badges on outputs that the base also uses
- `POPR`: Date and local time of the next population report
