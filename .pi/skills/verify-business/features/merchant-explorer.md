# Merchant Explorer images

The App listing tab of the merchant edit page: hero image, up to 4 slider images and the logo, each uploaded through a dropzone. Every raster upload opens a crop dialog first; when the image is already inside the accepted ratio (logo/icon 1:2 to 2:1, hero 4:3 to 2:1) it also offers "Use as is". SVGs and images too small for any crop go up untouched. Once set, a single-image field shows the image itself with Edit / Remove instead of the URL input and dropzone; the slider shows a grid of numbered image tiles plus an "Add image" tile instead of its dropzone.

## Sub-features

- `explorer-open` reaches `/m/$id/merchant/explorer` from a merchant card.
- `image-crop-logo` crops a too-wide logo: `dialog "Crop your image"` opens on `tab "2:1"` with no "Use as is", zoom via `slider "Zoom"`, `button "Crop and upload"`.
- `image-crop-presets` switches ratio with the `tab` presets (`4:3`, `16:9`, `2:1` for heroes) and cancels with `button "Cancel"`: nothing is uploaded.
- `image-crop-as-is` opens the dialog on an in-range image; `button "Use as is"` uploads the original bytes.
- `image-crop-batch` drops several files into the slider: one dialog per file, in order.
- `image-preview` shows the field's image (`img "Current image"`); `button "Edit"` reveals the URL input + dropzone, `button "Done"` hides them again.
- `slider-grid` shows each slide as `img "Slide N"` with `button "Remove image N"`, then `button "Add image (n/4)"` (click or drop) until 4; removing renumbers the rest. The full dropzone only shows while the slider is empty.

## How to get to it (user POV)

- Dashboard (`My stores`) → merchant card `link "Edit store"` (to `/merchant/customize`) → `tab "App listing"`.
- The same `ImageUploadField` also backs Identity & SDK (logo), the Ambassador page photo and component icons on the Customize tab; the crop applies there too.

## Driving it with verify-business.sh

Preconditions:

- `H doctor` is all `ok`; demo mode (default).

- **Whole recipe.** `H flow F/merchant-image-crop.mjs --width 1200` (the phone preview is hidden below 1264px, so the field preview is the only visual feedback). Verdict `PASS` (also at `--width 390`, one column), steps `01-explorer` … `09-slider-after-remove`; the console prints `LOGO OUTPUT { width: 400, height: 200 }` and `HERO AS-IS { width: 1600, height: 900 }`.
- **Open.** `locator('a[href$="/m/<id>/merchant/customize"]').click()`, then `getByRole("tab", { name: "App listing" }).click()`. URL ends `/merchant/explorer`.
- **Upload.** Find a dropzone's input from its restriction caption: `getByText(/At least 128×128 px/).locator("xpath=ancestor::div[.//input[@type='file']][1]").locator("input[type=file]")`, then `setInputFiles({ name, mimeType: "image/png", buffer })`. Build the buffer with a canvas in `page.evaluate` (see the flow). Hero and slider captions both hold `800×450 px`; only the slider's ends with `(n/4)`. A field showing its image has no dropzone until `Edit`; a non-empty slider's input sits in the add tile: `getByRole("button", { name: /Add image/ }).locator("xpath=ancestor::div[.//input[@type='file']][1]")`.
- **Result.** Demo uploads return a `blob:` URL; read `img "Current image"`'s `src` size with `new Image()` + `decode()` to prove the ratio.

## Gotchas

- Demo uploads return `blob:` URLs, which the field's https-only validator flags as "Enter a valid image URL". That is demo mode, not the crop.
- The dialog fades in: `await expect(dialog).toHaveCSS("opacity", "1")` before a `step()`, or the screenshot catches it semi-transparent.
- In `fr-FR` the tab is `Fiche dans l'app`, the dialog `Recadrez votre image`, the buttons `Utiliser telle quelle`, `Modifier`, `Terminé`.
- Full-page screenshots misplace the fixed dialog at phone widths, and paint the floating "Save all changes" bar over the middle of the page; use `page.screenshot()` (viewport) to judge either.
- In `fr-FR` slides are `Image N`, the add tile `Ajouter une image (n/4)`.
