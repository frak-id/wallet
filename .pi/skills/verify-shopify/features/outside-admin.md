# Pages outside the admin

Two pages render outside the Shopify admin, without App Bridge: the purchase page Shopify sends the merchant to after approving a budget charge (`/purchase`), and the login page for opening the app from outside the admin (`/auth/login`).

## Sub-features

- `purchase-states` the purchase page for a confirmed, pending, processing, declined or unknown purchase, with "Purchase details" and links to the funding page and to support.
- `login-form` "Log in" with a "Shop domain" field and its error message for an invalid or missing domain.

## How to get to it (user POV)

- After approving a budget purchase on Shopify's billing screen, Shopify redirects to `/purchase?charge_id=…`.
- Visiting the app URL directly, outside the admin, leads to `/auth/login`.

## Driving it with verify-shopify.sh

Preconditions:

- `H doctor` and `H mocks` pass.

- **Every state.** `VERIFY_ONLY=purchase,login H flow F/screens.mjs`. Steps `purchase-confirmed`, `purchase-pending`, `purchase-processing`, `purchase-declined`, `purchase-not-found`, `login`, `login-invalid-shop`.
- **Confirmed purchase.** `open("/purchase", { state: "confirmed" })`. `heading "Purchase details" [level=2]`, `link "funding page"` to `/app/funding`.
- **Login error.** `open("/auth/login", { error: "invalid" })`. `heading "Log in" [level=2]`; the screenshot shows "Please enter a valid shop domain to log in" under "Shop domain".

## Gotchas

- The login error comes from the real `auth.login/error.server.tsx`, the one server module the harness runs, so its wording always follows the tree under test.
- The field's error text is inside the Polaris field's shadow DOM and does not appear in the ARIA snapshot; assert it on the screenshot or with `getByText`.
- The purchase page's logo is loaded from frak.id, which the driver blocks: it shows as a broken image in the harness.
