# Page tours

A `Help` button on most pages opens a short driver.js tour of that page: a card next to each highlighted element, with Next, Back and Done, over a dimmed page. Pages with a sidebar also offer "Show the full tour", the eight-step welcome tour.

## Sub-features

- `tour-page` opens the current page's tour from `button "Help"` (header, wizard, store edit pages, push composer).
- `tour-steps` moves through the steps: each one highlights the element whose `data-tour` the step names, or centers the card when it names none.
- `tour-full` opens the welcome tour from `button "Show the full tour"` on the first step of a page tour.
- `tour-close` ends a tour with `Done`, `Close tour` or Escape; focus goes back to where it was.
- `tour-wizard` gives the campaign wizard its own one-step tours: the step rail, then the Budget, Rewards and Review screens.

## How to get to it (user POV)

- `button "Help"` in the header of every page that has a tour (no button on Frak staff pages).
- `button "Help"` in the top bar of the campaign wizard, the store wizard, the store edit pages and the push composer.
- The welcome tour starts by itself once for a new user, never in demo mode: in this harness reach it through `tour-full`.

## Driving it with verify-business.sh

Preconditions:

- `H doctor` is all `ok`; demo mode (default). The flow runs in `en-US` and `fr-FR`, at any width, and in `--webkit`.

- **Whole recipe.** `H flow F/tours.mjs`. Verdict `PASS`, steps `stores-first` through `wizard-review-last`.
- **Open a page tour.** `getByRole("button", { name: "Help", exact: true }).click()`. `locator(".driver-popover")` is a `dialog` named after the step title, still open 1.5 s later; progress reads `Step 1 of 4` on My stores; `Help` has `aria-expanded="true"`.
- **Steps.** `card.getByRole("button", { name: "Next" }).click()`. `.driver-active-element` carries the step's `data-tour` (My stores: none, `store-budget`, `store-edit`, `add-store`).
- **Full tour.** `card.getByRole("button", { name: "Show the full tour" }).click()`. `Step 1 of 8`, `button "Skip tour"` on every step but the last.
- **Close.** `Done` on the last step, or Escape. The card is gone, `Help` has `aria-expanded="false"`, and after a keyboard open `Help` has focus again.
- **Wizard tours.** On `camp_003`, Help opens one step on `wizard-steps`, then `campaign-budget-amount` on `/budget`, `campaign-reward-model` on `/reward`, `campaign-publish` on `/validation`. No "Show the full tour" there.

## Gotchas

- driver.js blocks clicks outside the card while a tour is open: close it before using the sidebar, or the click times out on `svg.driver-overlay`.
- The 1.5 s "still open" check passed with 536aa30b7's race fix reverted (Chromium, dev server): it proves the tour stays open here, not that the race is gone.
- Each step animates for about 400 ms; read `.driver-active-element` with `expect.poll`, not once.
- WebKit does not focus a button on click, so focus goes back to `body` after a clicked open. Prove focus return with a keyboard open (`focus()` then Enter).
- In the wizard the URL changes before the next screen renders: after `Continue`, wait on the `h1` text, not the URL, or the next click lands on the previous screen's button.
- `<html lang>` stays `en` when the interface is French; a flow that picks names by language reads `navigator.language`.
- Full-page screenshots show the dim overlay over the first 900 px only: it is fixed to the viewport.
