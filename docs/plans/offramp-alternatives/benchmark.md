# Off-ramp alternatives to Monerium

Status: benchmark, 2026-11-06. Scope: off-ramp only (stablecoin in the Frak wallet to the user's bank account).
Context: the Monerium production app is disabled and nobody at Monerium answers. The integration
(`docs/plans/monerium-backend/plan.md`) went live with PR #358 on 2026-11-03 and has no real usage yet.

## Constraints that filter the list

1. **Users are in France first.** OpenPanel, last 30 days: FR 15.1k sessions, DE 1.5k, US 1.5k, GB 0.4k.
   At least 6 of the 11 live merchants are French. EUR to a SEPA account is the requirement. GBP and USD are nice to have.
2. **MiCA.** The last transitional periods ended on 1 July 2026. To serve a French resident, the provider
   must be an authorised CASP (or act through one). This rule alone removes Transak and Mt Pelerin (see "Excluded").
3. **Kernel smart account on Arbitrum One**, with a passkey signer, so signatures are ERC-1271. Any flow where the provider hands us
   a deposit address works: the wallet sends one userOp transfer. Any wallet-ownership check must accept
   ERC-1271 (and ERC-6492 for undeployed accounts).
4. **Tokens we hold:** EURe, GBPe and USDe from Monerium, plus USDC. Rewards default to EURe (PR #145).

## Shortlist

| Provider | Integration | EU licence | Arbitrum token accepted | EUR | GBP | USD | Published fee (bank payout) |
|---|---|---|---|---|---|---|---|
| **Monerium** (baseline, blocked) | API, already built | EMI (Central Bank of Iceland) | EURe, redeemed 1:1 | SEPA, own and third-party IBAN | no GBP IBANs, even at Monerium | — | 0 (Slack, 2026-05-07) |
| **Ramp Network** | Widget + "native flow" (the wallet sends) | MiCA, Central Bank of Ireland, live Jan 2026 | USDC, USDC.e | SEPA + SEPA Instant | no Faster Payments: EUR SEPA or card payout | ACH / RTP | 0.99%, min €1.99 / $1.99 · card 4.49% |
| **MoonPay** (Sell widget) | Widget / SDK | MiCA, AFM (MoonPay Europe B.V., 30/12/2024) | USDC (min ≈ 20 USDC) | SEPA, bank must be verified first | Faster Payments, same rule | ACH | up to 1% + spread; partner minimum fee up to €4.50 |
| **MoonPay Enterprise** (ex-Iron) | API: one deposit address per customer + IBAN | MoonPay group, EEA entity to confirm | USDC, PYUSD | SEPA, own and third-party | FPS / CHAPS, own account only | ACH / Wire / FedNow | negotiated fee profile, "typically about 1%" + rail fee |
| **Bridge** (Stripe) | API: liquidation address | MiCA + EMI, CSSF Luxembourg (June 2026) | USDC (EEA: USDC/EURC only) | SEPA (enabled by sales), own and third-party | Faster Payments (min 3) | ACH / Wire | not public, plus an optional developer fee |
| **Banxa** | Widget / API | MiCA, AFM (Oct 2025) | USDC | SEPA | — | — | "0% processing", everything is in the spread |
| **Coinbase Offramp** | Widget, **user needs a Coinbase account** | MiCA, CSSF (Coinbase Luxembourg) | USDC | through the user's Coinbase balance | through Coinbase | ACH | 0% on USDC for approved apps |
| **Mercuryo** | Widget | through Criptan Trade (CNMV CASP) | not checked | SEPA, card | not checked | not checked | up to 3.95%, min €3–4 |

### Excluded

- **Transak**: not in the ESMA register (checked 30/10/2026), and no EU country on its list since ~Oct 2026. UK and US still work, which is useless for France.
- **Mt Pelerin**: technically the best fit, but it can't be offered to EU or UK users from our app.
  - Fit: 0% on the first CHF 500/year per user, then 1.3% with no spread; free SEPA; ERC-1271/6492 address validation
    with `chain=arbitrum_mainnet`; no ID check up to CHF 999/month (phone + email only); an `orderCreated` postMessage carries
    `offRampAddress`, so the wallet can send the funds itself.
  - Licence: Swiss SRO (SO-FIT) only, no MiCA and no FCA authorisation. Its privacy policy reads: brokerage services "not offered,
    marketed or otherwise made available to residents of the European Union or the United Kingdom, except where the client
    contacts Mt Pelerin exclusively on their own initiative". It is on the FCA warning list (2026-01-27).
  - Why that excludes us: MiCA art. 61 removes the reverse-solicitation exemption whenever an entity "acting on its behalf"
    solicits clients, whatever the disclaimer says. ESMA's guidelines name "the provision of the means of access", "the
    displaying of the third-country firm's logo" and any remuneration (the `_ctkn` revenue share) as signs of acting on its behalf.
    A "Cash out" button in Frak Wallet is exactly that.
  - Still usable for Switzerland (13k all-time sessions; CHF over SIC is free and same-day) and other non-EU/UK/US users, behind a
    country gate. Ask them whether an EU-authorised entity is planned: with MiCA they would rank first.
- **Noah**: no Arbitrum support (its networks are Base, Ethereum, Polygon, Solana, Gnosis, Celo…).
- **Onramper**: an aggregator (7+ off-ramps, subscription + revenue share) with no licence of its own. Only useful
  as a layer if we want several widget providers behind one integration.

## Stablecoins: what can actually be off-ramped

No provider accepts EURe, GBPe or Monerium's USDe, and nobody accepts EURC on Arbitrum (Circle does not issue it there).
**USDC on Arbitrum is the only token every provider takes**, so a EUR reward goes EURe → USDC → EUR.

- EURC chains (Circle, 2026-11): Arc, Avalanche, Base, Cronos, Ethereum, Plasma, Solana, Stellar, World Chain. Arbitrum is not one of them.
- Ramp's off-ramp catalog (`/host-api/v3/offramp/assets`) lists these EUR tokens: EURC on Stellar only, EURQ / EURR / EURT
  on Ethereum mainnet, cEUR on Celo. None is on an EVM chain where our account lives with cheap gas.
- A EUR-in, EUR-out route with no USD leg exists only through API providers: Bridge and MoonPay Enterprise take EURC on Base or Ethereum to SEPA.
  From Arbitrum that still means EURe → USDC → CCTP to Base → EURC, so it only pays off if rewards move to Base.

CoW quotes on Arbitrum, measured on 2026-11-06 (`signingScheme: eip1271`), against spot EUR/USD 1.1220 (Coinbase):

| Sell | 20 | 100 | 500 | 2 000 |
|---|---|---|---|---|
| EURe → USDC, rate | 1.1212 | 1.1217 | 1.1216 | 1.1211 |
| cost vs spot (CoW fee included) | 0.07% | 0.03% | 0.03% | 0.08% |
| GBPe → USDC | no route | no route | no route | — |
| USDe (Monerium) → USDC | no route | no route | no route | — |

- The EURe → USDC leg costs almost nothing. The expensive leg is the provider's USD → EUR conversion, and none of the MiCA providers publish their spread.
- **GBPe and Monerium USDe have no exit without Monerium**: there is no liquidity on Arbitrum, and no other off-ramp takes them.
  Monerium itself does not offer GBP IBANs (its knowledge base, Oct 2025), so GBPe was never paid out to a UK bank.
  For the CoW module, the GBP and USD path is USDC, converted at payout by a provider with Faster Payments or ACH.

## Cost of a typical cash-out (EURe → French IBAN)

This includes the provider fee and CoW, but **not the provider's USD → EUR spread**, which nobody publishes.
Reward balances are small, so minimum fees decide the ranking.

| Provider | €20 | €100 | €500 |
|---|---|---|---|
| Monerium | €0 | €0 | €0 |
| Ramp | €1.99 (10%) | €1.99 (2%) | €4.95 (1%) |
| MoonPay widget | up to €4.50 (≈ 22%) | up to €4.50 (4.5%) | ≈ €5 (1%) |
| Mercuryo | €3–4 (15–20%) | €3.95 | €19.75 |
| MoonPay Enterprise / Bridge | % only, negotiated (≈ 1% gives €0.20 / €1 / €5) | | |
| Coinbase | €0 on USDC (approved apps), plus Coinbase's own SEPA withdrawal | | |
| Banxa | spread only, not published | | |

## UX: three shapes

1. **Hosted widget (Ramp, MoonPay, Banxa, Mercuryo).** The user opens an account with the provider (email, ID + selfie),
   types the IBAN in the provider's UI, and the widget then asks the wallet to "send X USDC to address Y".
   With Ramp's native flow (`onSendCrypto`) the send is our userOp. The provider's branding and support stay in the loop.
   - Ramp: SEPA Instant pays out in seconds, and Ramp checks the IBAN up front. Payouts go to the user's own account only.
   - MoonPay: UK/EU users must first verify the bank, by topping up €1 or buying with that bank. That step loses
     reward users who never bought crypto.
   - On Tauri, the callback only works if the widget is embedded (iframe/WebView), not opened in the system browser. Camera access for KYC inside the WebView still needs testing.
2. **Exchange account (Coinbase).** It only works for users who already have a Coinbase account with a linked bank; everyone else signs up at Coinbase.
   The transfer must go out within 30 minutes, and Coinbase checks that `from_address` is the smart account. It suits crypto-natives as a secondary option.
3. **API + a deposit address per user (MoonPay Enterprise, Bridge).** Our UI end to end: a one-time hosted KYC link
   (like the Monerium portal today), the IBAN registered over the API, and a permanent deposit address per (user, IBAN).
   Each cash-out is one userOp transfer, and webhooks drive the status and the push notifications. **This is the shape we already built for
   Monerium**: IBAN form + saved IBANs, amount/recap/success screens, `app-essentials/monerium` IBAN helpers,
   tracked orders + sync cron + push in the backend. Third-party IBANs work for EUR on both.
   - MoonPay Enterprise documents ERC-1271 and ERC-6492 for wallet registration. That registration is what clears deposits of €1,000 or more without AML review and allows automatic returns.
   - The cost is a B2B contract, KYB of Frak and a sales cycle, which only pays off with volume.

## Recommendation

1. **Now: Ramp Network** widget with the native flow, USDC on Arbitrum, and a CoW EURe → USDC swap before the send.
   Implemented on `feat/ramp-offramp`, see [ramp-integration.md](ramp-integration.md) for the launch checklist.
   It holds a MiCA licence in the EU, has SEPA Instant, publishes its fees, covers US users over ACH/RTP, and its flow is built for wallets that send the funds themselves.
   Downsides: the €1.99 minimum bites on small balances, payouts go to the user's own IBAN only, and UK users get EUR SEPA or a card payout instead of GBP.
2. **Next: an API provider** to get the native UX back. Ask **MoonPay Enterprise** and **Bridge** for:
   - fee profiles for EUR SEPA, GBP FPS and USD ACH, from USDC on Arbitrum;
   - the USD → EUR spread and the minimums;
   - which entity onboards EEA individuals;
   - sandbox access.

   On paper MoonPay Enterprise is ahead (GBP FPS, documented ERC-1271/6492, third-party EUR). Bridge has Stripe behind it and a MiCA licence plus an EMI licence.
3. **Keep the Monerium code paths.** It is still the only zero-fee EURe redemption with no currency conversion, so turn it back on if Monerium answers.
4. **Reward tokens:** reconsider GBPe and Monerium USDe for new campaigns: they have no exit without Monerium.
   USDC covers USD and, after conversion at payout, GBP. EURe can stay as long as the CoW swap holds.

## Several providers, one picker

Letting the user choose does not make Mt Pelerin legal for EU/UK residents. A menu entry in our app is "the provision of
the means of access" plus the provider's logo plus revenue share (ESMA guideline 2, para. 20), and art. 61 applies "notwithstanding
any disclaimer". So the list must be filtered by residence, not only ranked.

| Declared residence | Options shown | Default |
|---|---|---|
| EU/EEA | Monerium (once its app works again), Ramp | Monerium (no fee, no FX), else Ramp |
| UK | Ramp (EUR SEPA or card) | Ramp |
| US | Ramp (ACH / RTP) | Ramp |
| Switzerland | Mt Pelerin, Ramp | Mt Pelerin (CHF over SIC, free up to CHF 500/year) |
| Rest of world (not sanctioned) | Mt Pelerin, Ramp | the larger net amount |

- Residence: ask once on the first cash-out and store it server-side. If IP geolocation says EU/UK, also hide Mt Pelerin.
  Get a legal sign-off on that gate, since it is the only control (Mt Pelerin itself does not refuse EU users).
- Show the net amount received, the fee, the delay and whether an ID check is needed, with the best option preselected.
  Remember the provider the user already onboarded with, because switching means doing KYC again.
- Backend: an `offramp` orchestrator (`GET /user/wallet/offramp/options`) merges the Monerium status, the stored residence and the
  static eligibility rules, since that logic spans several domains.
- Wallet: `TransferModal` already has a "bank" row that opens `moneriumBankFlow`. It would open the picker instead,
  and each provider keeps its own flow.
- Shared pieces: the CoW EURe → USDC step (Ramp, Mt Pelerin), one "send X to address Y" userOp, history.
- Per-provider pieces:
  - Monerium: already built.
  - Ramp: widget plus `onSendCrypto`, embedded in an iframe on web and a WebView on Tauri.
  - Mt Pelerin: widget plus the `MtPelerin-{code}` ERC-1271 signature (once per address, so one passkey prompt that can be
    stored) plus the `orderCreated` event, which carries `offRampAddress`.

## CoW module notes

- From Kernel, sign the order with ERC-1271 (passkey), or batch `approve` + `setPreSignature` in one userOp.
- Setting the order `receiver` to the provider's deposit address would save one step, but the funds would then arrive from
  the settlement contract instead of the user's wallet. That breaks Coinbase's `from_address` check and travel-rule wallet matching, so keep two steps: swap, then send.
- Quote-based deposits (Ramp, MoonPay, MoonPay Enterprise quotes) expect an exact amount. Either use a CoW buy order
  for that exact USDC amount, or send from the USDC balance after the swap settles.

## Open before committing

- Effective rates (fee + spread) for 20/100/500 USDC → EUR on Ramp and MoonPay. The public quote endpoints reject calls
  without a partner key (`hostApiKey` / `apiKey`), so we need sandbox keys.
- Self-hosted wallet checks of €1,000 or more under the EU Transfer of Funds Regulation, in the Ramp and MoonPay widgets: do they ask for a signature, and do they accept ERC-1271?
- The Ramp widget inside the Tauri WebView: postMessage callbacks and the camera for KYC.
- Re-measure the EURe depth on CoW before larger amounts depend on it.

## Sources

- Ramp: [sell fees](https://support.rampnetwork.com/en/articles/8957-what-are-the-fees-for-selling-crypto) · [payout methods](https://support.rampnetwork.com/en/articles/8992-which-payout-methods-can-i-use-when-selling-crypto) · [MiCA live](https://rampnetwork.com/blog/casp-eu-live) · [native flow](https://docs.rampnetwork.com/off-ramp-native-flow/integration) · off-ramp asset list from `api.ramp.network/api/host-api/v3/offramp/assets`
- MoonPay: [pricing disclosure](https://www.moonpay.com/legal/europe_pricing_disclosure) · [sell guide (bank verification)](https://support.moonpay.com/en/articles/384277-how-do-i-sell-cryptocurrency-with-moonpay) · [MiCA](https://www.moonpay.com/newsroom/mica-what-it-means-for-eu-crypto-holders) · `api.moonpay.com/v3/currencies` (`usdc_arbitrum`, `isSellSupported: true`)
- MoonPay Enterprise: [payouts](https://dev.enterprise.moonpay.com/offramp) · [crypto addresses (ERC-1271/6492)](https://dev.enterprise.moonpay.com/crypto-addresses.md) · [stablecoins and chains](https://dev.enterprise.moonpay.com/stablecoins-and-blockchains.md)
- Bridge: [route explorer](https://apidocs.bridge.xyz/get-started/introduction/what-we-support/payment-routes) · [EUR guide](https://apidocs.bridge.xyz/get-started/guides/move-money/eur-integration-guide) · [MiCA + EMI](https://www.bridge.xyz/blog/bridge-secures-mica-and-emi-authorisations-across-all-27-eu-member-states)
- Banxa: [MiCA](https://banxa.com/press/banxa-secures-mica-licence-in-the-netherlands/) · [pricing](https://support.banxa.com/en/support/solutions/articles/44002465167-how-does-banxa-set-the-price-of-cryptocurrency-)
- Coinbase: [offramp guide](https://docs.cdp.coinbase.com/onramp/offramp/offramp-integration-guide) · [FAQ (account required)](https://docs.cdp.coinbase.com/onramp/additional-resources/faq) · [zero-fee USDC](https://www.coinbase.com/developer-platform/discover/launches/zero-fee-usdc)
- Mercuryo: [fees](https://help.mercuryo.io/hc/en-gb/articles/30404513537565-How-does-Mercuryo-calculate-the-price-and-fees-for-my-transaction) · [licences](https://www.mercuryo.io/legal/licenses/)
- Transak: [Skrumble review, Oct 2026](https://skrumble.com/on-ramps/transak-review/) · [registromica.es](https://registromica.es/marca/transak.html)
- Mt Pelerin: [off-ramp pricing](https://developers.mtpelerin.com/service-information/pricing-and-limits/off-ramp-pricing) · [ERC-1271 address validation](https://developers.mtpelerin.com/integration-guides/parameters-and-customization/automating-the-end-user-address-validation/parameters) · [EU status](https://www.traderfrancophone.fr/en/Mount-Pilgrim-Reviews/)
- Monerium: [GBPe IBANs](https://help.monerium.com/article/12-gbpe-ibans)
- CoW quotes: `POST https://api.cow.fi/arbitrum_one/api/v1/quote`, 2026-11-06
