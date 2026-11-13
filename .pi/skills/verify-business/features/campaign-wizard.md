# Campaign wizard

A full-screen, step-by-step form to create a campaign or resume a draft: basics, goals, territory, budget & schedule, products (sales goals only), reward setup, referral chain and validation, with a step list on the left and Continue/Back/Save as draft/Cancel actions.

## Sub-features

- `wizard-new` opens empty basics from `link "Create new campaign"`; `button "Continue"` stays disabled until `textbox "Campaign title"` has a value.
- `wizard-advance` moves to the next step on Continue and marks the previous one `completed` in the step list (`listitem "Step N: <name>, completed|current|upcoming"`).
- `wizard-resume` reopens a draft with its saved values from the detail sheet's `link "Edit campaign"`.
- `wizard-budget` sets the budget period (`radio "Global|Daily|Weekly|Monthly"`), `spinbutton "Budget cap"` and the schedule (`radio "Start immediately…"`, `"Start date only…"`, `"Start + End date…"`).
- `wizard-reward` sets the reward model and the ambassador / referee amounts.

## How to get to it (user POV)

- Campaign list → `link "Create new campaign"` (in the page or in the header).
- Campaign list → a draft row → detail sheet → `link "Edit campaign"`.
- A step's URL directly: `/m/$id/campaigns/draft/<id>/<step>` with step `goals`, `territory`, `budget`, `products`, `reward`, `referral-chain`, `validation` (empty step = basics).

## Driving it with verify-business.sh

Preconditions:

- `H doctor` is all `ok`; demo mode (default).

- **New campaign.** `H flow F/campaign-wizard.mjs`. Verdict `PASS`, steps `01-basics-filled`, `02-goals`. From the list, `getByRole("main").getByRole("link", { name: "Create new campaign" }).click()` → `heading "Campaign basics"`, Continue disabled; fill the title → enabled; Continue → URL ends `/campaigns/draft/<new id>/goals`, `heading "Goals"`, `listitem "Step 1: Campaign basics, completed"`.
- **Resume a draft to the budget step.** `H flow F/draft-resume.mjs` (add `--width 390` for the phone layout). Verdict `PASS`, steps `01-basics`, `02-budget`. Draft tab → cell "Draft Campaign - Registration Focus" → `dialog` → `link "Edit campaign"` → title prefilled; Continue three times through `Goals`, `Territory & categories` → `heading "Budget & schedule"`, URL `/campaigns/draft/camp_003/budget`, `radio "Weekly"` checked, `spinbutton "Budget cap"` = `750`.
- **Layout of every step.** `H flow F/split-words.mjs --width <w> --locale fr-FR` covers all steps of `camp_003`.

## Gotchas

- `Create new campaign` exists twice on the list (header and main); scope it.
- Step numbers are not stable: a new campaign lists 8 steps (with `Products`), `camp_003` lists 7 (no `Products`). Match steps by name.
- Continue in demo mode never reaches the backend: `useSaveCampaign` fakes the save after 300 ms and assigns a demo id. It proves the form and navigation, not that the API accepts the payload.
- A draft row click opens the detail sheet, not the wizard.
- Below 768px the step list stacks above the form and the Continue footer is fixed to the viewport, so a full-page `step()` shows Continue over the middle of the form. For a clean shot of one card, use `locator.screenshot()`. The round badge bottom-right is the TanStack devtools button, dev builds only.
- Option rows here (budget period, schedule, reward model) once broke labels mid-word on narrow cards; check layout changes at 390px in French, where "Hebdomadaire" and "Récompenses par paliers" are the long labels.
