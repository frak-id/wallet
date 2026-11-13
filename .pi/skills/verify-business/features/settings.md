# Settings

The account page: wallet address, login methods, two-factor authentication, active sessions, display currency, interface language and the demo-mode switch, with billing on a second tab.

## Sub-features

- `settings-open` opens `/settings` from the header's `link "demo"` badge.
- `settings-currency` picks the display currency in `radiogroup "Currency"` (`EUR`, `GBP`, `USD`).
- `settings-language` switches the whole interface in `radiogroup "Language"` (`English`, `French`).
- `settings-demo` turns demo mode off with the `switch` at the bottom of the page.
- `settings-billing` opens `tab "Billing"` (`/settings/billing`).

## How to get to it (user POV)

- Header `link "demo"` (shown only in demo mode).
- The account button in the header (`button "E-Commerce Store"`) opens a `dialog` with `link "Settings"` and `button "Log out"`.

## Driving it with verify-business.sh

Preconditions:

- `H doctor` is all `ok`; demo mode (default).

- **Whole recipe.** `H flow F/settings.mjs`. Verdict `PASS`, steps `01-settings`, `02-settings-fr`.
- **Open.** `getByRole("banner").getByRole("link", { name: "demo" }).click()`. URL ends `/settings`; `heading "Settings" [level=1]`; `radio "EUR"` and `radio "English"` checked.
- **Language.** `getByRole("radio", { name: "French" }).click()`. `heading "Paramètres"`, `radio "Français"` checked, the sidebar reads "Mes marchands", "Campagnes".

## Gotchas

- Login methods, two-factor status, active sessions and billing documents come from `/business/auth/*` and billing endpoints that demo mode does not mock; the harness blocks them, so those blocks stay empty or show a spinner. That is the harness, not a bug.
- Turning the demo switch off clears the session and lands on `/login`; every later step of the flow runs logged out.
- The language choice is stored as `i18nextLng` in localStorage and holds for the rest of the run.
