# Profile

The profile page (`/profile`) shows how secure the wallet is, offers to add a recovery email, toggles notifications, links to favorite brands, referrals, legal pages and support, connects a Monerium account, and logs the user out.

## Sub-features

- `profile-render` shows `heading "Profile"`, the `Wallet security progress` progressbar and the app version line.
- `profile-add-email` opens `/profile/add-email`, whose `Continue` button stays disabled until an email is typed.
- `profile-notifications` shows the notifications `switch` and, when the browser blocks them, an explanatory paragraph.
- `profile-favorites` opens `/profile/favorites` with an empty state.
- `profile-referrals` opens `/profile/referral` (see [Referral code](./referral-code.md)).
- `profile-logout` clears the session and lands on `/register?new=false`.

## How to get to it (user POV)

- Choose `Profile` in the bottom tab bar.
- Choose `Back` on any `/profile/*` sub-page.

## Driving it with verify-wallet.sh

Preconditions:

- `H doctor` is all `ok`.
- Default seeded session. No shipped flow yet: write one in `/tmp` from the calls below and run `H flow spa /tmp/<name>.mjs`.

- **Tab entry.** From `/wallet`, `getByRole("navigation", { name: "Tab navigation" }).getByRole("link", { name: "Profile", exact: true }).click()`. URL ends `/profile`; `heading "Profile" [level=1]`, `progressbar "Wallet security progress"` and paragraph `0%` are visible.
- **Add email.** `getByRole("button", { name: "Add an email" }).click()`. URL ends `/profile/add-email`; `heading "Add your email"`; `button "Continue"` is disabled until `getByRole("textbox", { name: "Email" }).fill(...)`.
- **Notifications.** The `switch` has no accessible name; locate it with `getByRole("switch")`. Under headless Chromium the paragraph "Notifications blocked by browser. Enable them in browser settings." is shown.
- **Favorites.** `getByRole("link", { name: "My favorite brands" }).click()`. URL ends `/profile/favorites`; `heading "No favorites yet" [level=3]`.
- **Logout.** `getByRole("button", { name: "Logout" }).click()`. URL becomes `/register?new=false` with `button "Get started"`, `button "Already have an account?"` and `button "I have a reward code"`.
- **Proof.** `step()` after each landing; for logout also assert the URL before the screenshot.

## Gotchas

- The harness re-seeds the session on every document load (an init script). After `Logout`, any reload or `page.goto` logs the user back in. Assert the logged-out state on the page logout lands on, without navigating again.
- `Add an email` → `Continue` posts to the backend, which is not mocked: the request is blocked. Mock the endpoint in the flow and assert the request before claiming the email step works.
- Legal links leave the app (`https://frak.id/privacy`, `/terms`, `mailto:hello@frak.id`); assert their `href`, do not click them (off-origin navigations are blocked).
- `Connect` (Monerium) starts an OAuth redirect to an external origin; it is not drivable here.
