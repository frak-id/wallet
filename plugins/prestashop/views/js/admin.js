/**
 * Frak admin: live logo preview.
 *
 * Hooks the URL input + file picker so the merchant sees the logo render
 * before submitting. Two paths:
 *   - URL input → src is the typed value (clears the file picker so we
 *     don't submit a stale upload alongside a deliberate URL change).
 *   - File picker → src is a base64 data URL via FileReader (no upload
 *     until the form is actually submitted).
 *
 * Loaded via {@see AdminFrakIntegrationController::setMedia()} only on the
 * Frak configuration page (ModuleAdminController scopes setMedia per-route).
 * Extracted from `configure.tpl` so the admin page is CSP-friendly
 * (no `unsafe-inline` required) and the JS gets browser-cached across page
 * loads instead of being re-shipped on every render.
 */
document.addEventListener('DOMContentLoaded', function () {
    const logoUrlInput = document.getElementById('logo_url_input');
    const logoFileInput = document.getElementById('logo_file_input');
    const logoPreviewContainer = document.getElementById('logo_preview_container');
    const noLogoText = document.getElementById('no_logo_text');
    let logoPreview = document.getElementById('logo_preview');

    function updatePreview(src) {
        if (!src) {
            if (logoPreview) {
                logoPreview.style.display = 'none';
            }
            return;
        }

        if (logoPreview) {
            logoPreview.src = src;
            logoPreview.style.display = 'block';
        } else if (logoPreviewContainer) {
            // Lazily create the <img> the first time the merchant supplies a
            // logo on a page that started with no preview. Re-find on the
            // module reference so subsequent updates hit the same node.
            const img = document.createElement('img');
            img.id = 'logo_preview';
            img.src = src;
            img.alt = 'Logo preview';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '80px';
            logoPreviewContainer.appendChild(img);
            logoPreview = img;
        }

        if (noLogoText) {
            noLogoText.style.display = 'none';
        }
    }

    if (logoUrlInput) {
        logoUrlInput.addEventListener('input', function () {
            updatePreview(this.value);
            // Typing a URL clears any selected file so the form submits
            // exactly one source of truth (URL XOR file).
            if (this.value && logoFileInput) {
                logoFileInput.value = '';
            }
        });
    }

    if (logoFileInput) {
        logoFileInput.addEventListener('change', function () {
            const file = this.files[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = function (e) {
                updatePreview(e.target.result);
            };
            reader.readAsDataURL(file);
        });
    }
});
