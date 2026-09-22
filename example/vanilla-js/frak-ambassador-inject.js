/* Frak — page ambassadeur (direction K) à coller dans la console d'une
 * boutique marchande : remplace le contenu principal, en-tête et pied restent,
 * auto-theme immédiat sur la page hôte. __frakAmb.remove() restaure le contenu
 * d'origine ; aussi disponibles : autoTheme, cloneClasses/undoClone, reset,
 * set('accent', '#c0392b'). */
(() => {
    const CSS =
        '[data-frak-page]{--_accent:var(--frak-amb-accent,#111);--_ink:var(--frak-amb-accent-ink,#fff);--_surface:var(--frak-amb-surface,rgba(17,17,17,.04));--_border:var(--frak-amb-border,rgba(17,17,17,.15));--_radius:var(--frak-amb-radius,12px);--_cta-radius:var(--frak-amb-cta-radius,999px);--_cta-bg:var(--frak-amb-cta-bg,var(--_accent));--_tag-bg:var(--frak-amb-tag-bg,#fff);display:grid;gap:clamp(3em,7vw,5.5em);}@supports (color: color-mix(in srgb, red 4%, transparent)){[data-frak-page]{--_surface:var(--frak-amb-surface,color-mix(in srgb,var(--_accent) 4%,transparent));--_border:var(--frak-amb-border,color-mix(in srgb,var(--_accent) 15%,transparent));}}[data-frak-page] section{display:grid;gap:.85em;align-content:start}:where([data-frak-page]) h1{font-size:var(--frak-amb-h1-size,clamp(2em,4.6vw,3.2em));font-weight:var(--frak-amb-h1-weight,inherit);letter-spacing:var(--frak-amb-h1-spacing,normal);color:var(--frak-amb-h1-color,inherit);line-height:1.1;margin:0}:where([data-frak-page]) h2{font-size:var(--frak-amb-h2-size,clamp(1.4em,2.6vw,2em));font-weight:var(--frak-amb-h2-weight,inherit);letter-spacing:var(--frak-amb-h2-spacing,normal);color:var(--frak-amb-h2-color,inherit);line-height:1.2;margin:0}:where([data-frak-page]) h3{font-size:1.05em;line-height:1.3;margin:0}:where([data-frak-page]) p{margin:0}.frak-center{text-align:center;justify-items:center}.frak-lede{max-width:52ch;opacity:.75}.frak-center .frak-lede{margin-inline:auto}.frak-muted{opacity:.7}.frak-small{font-size:.85em}.frak-cta{display:inline-flex;align-items:center;justify-content:center;background:var(--_cta-bg);color:var(--_ink);border:0;border-radius:var(--_cta-radius);padding:.95em 2em;font:inherit;font-size:var(--frak-amb-cta-size,.9em);font-weight:var(--frak-amb-cta-weight,700);letter-spacing:var(--frak-amb-cta-spacing,.06em);text-transform:var(--frak-amb-cta-transform,uppercase);cursor:pointer;text-decoration:none}.frak-cta:hover{opacity:.85}.frak-cta:disabled{opacity:.5;cursor:default}.frak-cols{display:grid;gap:1.25em;grid-template-columns:repeat(auto-fit,minmax(15em,1fr))}.frak-card{display:grid;gap:.5em;align-content:start;background:var(--_surface);border:1px solid var(--_border);border-radius:var(--_radius);padding:1.4em}.frak-step{inline-size:1.9em;block-size:1.9em;display:grid;place-items:center;margin:0;border-radius:var(--_cta-radius);background:var(--_accent);color:var(--_ink);font-weight:700;font-size:.9em}.frak-amount{display:block;font-size:clamp(3.5em,14vw,7em);line-height:.85;margin-block-end:.12em;font-weight:800;letter-spacing:-.04em;color:var(--_accent)}.frak-art-img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover;border-radius:var(--_radius)}.frak-hero{display:grid;gap:2.5em;grid-template-columns:repeat(auto-fit,minmax(18em,1fr));align-items:center}.frak-hero>div:not(.frak-art){display:grid;gap:1em;align-content:start;justify-items:start}.frak-art{position:relative;aspect-ratio:4/5;border-radius:var(--_radius);display:grid;place-items:center;text-align:center;padding:1em;background:var(--frak-amb-image,var(--_surface)) center/cover;border:1px solid var(--_border)}.frak-tag{position:absolute;inset:auto 1em 1em;display:flex;flex-wrap:wrap;align-items:center;gap:.75em;text-align:start;background:var(--_tag-bg);border-radius:var(--_radius);padding:.9em 1em}.frak-tag b{display:block;font-size:1.4em;line-height:1.1;color:var(--_accent)}.frak-tag small{display:block;font-size:.8em;opacity:.7}.frak-pill{margin-inline-start:auto;background:var(--_accent);color:var(--_ink);border-radius:var(--_cta-radius);padding:.45em .8em;font-size:.72em;font-weight:700;letter-spacing:.04em}.frak-faces{display:flex;flex-wrap:wrap;gap:.6em;align-items:center}.frak-faces span{inline-size:2.2em;block-size:2.2em;border-radius:50%;display:grid;place-items:center;font-size:.75em;font-weight:700;background:var(--_accent);color:var(--_ink)}[data-frak-page] :focus-visible{outline:2px solid currentColor!important;outline-offset:2px!important}.frak-badges{display:flex;flex-wrap:wrap;gap:.75em;align-items:center}.frak-badge{display:inline-flex;align-items:center;gap:.5em;text-decoration:none;background:#000!important;color:#fff!important;border:1px solid #a6a6a6;border-radius:8px;padding:.5em .9em;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.15}.frak-badge svg{flex:none}.frak-badge small{display:block;font-size:.62em;opacity:.9}.frak-badge strong{display:block;font-size:.95em;font-weight:600}.frak-store{display:grid;gap:1.75em;grid-template-columns:repeat(auto-fit,minmax(14em,1fr));align-items:center;background:var(--_surface);border:1px solid var(--_border);border-radius:var(--_radius);padding:1.75em}[data-frak-page] details{border-bottom:1px solid var(--_border);padding:.9em 0}[data-frak-page] summary{cursor:pointer;font-weight:700;list-style:none}[data-frak-page] summary::-webkit-details-marker{display:none}[data-frak-page] summary::after{content:"+";float:right;color:var(--_accent);font-weight:700}[data-frak-page] details[open] summary::after{content:"–"}[data-frak-page] details p{margin-top:.6em;opacity:.75}';
    const HTML =
        '<div data-frak-page lang="fr"><section class="frak-hero"><div><p class="frak-muted frak-small">Programme ambassadeur</p><h1>Devenez ambassadeur de {BRAND}.</h1><p class="frak-lede">Vous parlez déjà de {BRAND} autour de vous. Nous vous en remercions&nbsp;: une récompense sur chaque commande que vous inspirez, et quelques attentions réservées à nos ambassadeurs.</p><button type="button" class="frak-cta" data-frak-share>Devenir ambassadeur</button><div class="frak-faces"><p class="frak-muted frak-small">Rejoignez les ambassadrices et ambassadeurs de la marque</p></div></div><div class="frak-art"><img data-frak-hero alt="Ambassadrices et ambassadeurs {BRAND}" class="frak-art-img"><div class="frak-tag"><div><b data-frak-reward="{REWARD}" data-frak-no-reward="Une récompense">{REWARD}</b> <small>pour vous, par commande</small></div> <span class="frak-pill" data-frak-reward-referee="+ {REWARD} offerts à votre filleul">+ {REWARD} offerts à votre filleul</span></div></div></section><section class="frak-center"><p class="frak-muted frak-small">Programme de parrainage</p><h2><span class="frak-amount" data-frak-reward="{REWARD}" data-frak-no-reward="Une récompense">{REWARD}</span> pour vous, à chaque ami qui commande.</h2><p class="frak-muted frak-small">Estimation&nbsp;: le montant dépend de la campagne et du panier de votre proche.</p><p class="frak-lede">Pas de plafond, pas de montant minimum. Vous partagez ce que vous aimez déjà, vous êtes payé quand ça marche.</p><button type="button" class="frak-cta" data-frak-share>Obtenir mon lien</button><p class="frak-muted frak-small">Gratuit · sans engagement · versé sur votre compte bancaire</p></section><section><h2>Vous recommandez déjà {BRAND}. Il manque juste le lien.</h2><p class="frak-lede">Un message à une amie, une réponse dans un groupe, une adresse donnée au dîner&nbsp;: ces commandes existent déjà. Elles ne sont simplement rattachées à personne.</p><p class="frak-muted">Votre lien ne change pas votre façon de recommander&nbsp;; il rend la recommandation identifiable, pour que la commande qui en découle vous revienne. Un créateur touche une commission sur une vente. Vous touchez la même chose sur la vôtre, quelle que soit la taille de votre audience.</p></section><section><h2>Comment devenir ambassadeur {BRAND}</h2><p class="frak-lede">Trois gestes, rien de plus.</p><div class="frak-cols"><div class="frak-card"><p class="frak-step" aria-hidden="true">1</p><h3>Je partage</h3><p class="frak-muted">Vous transmettez votre lien à qui vous voulez&nbsp;: de bouche à oreille, en story ou par message.</p></div><div class="frak-card"><p class="frak-step" aria-hidden="true">2</p><h3>J’installe</h3><p class="frak-muted">Votre ami installe l’app Frak en quelques secondes, et bénéficie lui aussi d’un avantage sur sa commande.</p></div><div class="frak-card"><p class="frak-step" aria-hidden="true">3</p><h3>Je récupère mon argent</h3><p class="frak-muted">Dès qu’il commande, vos gains arrivent dans votre porte-monnaie Frak, prêts à être transférés quand vous le souhaitez.</p></div></div></section><section><h2>Comment vous êtes payé</h2><p class="frak-lede">La question que tout le monde se pose en premier.</p><div class="frak-cols"><div class="frak-card"><h3>Crédité instantanément</h3><p class="frak-muted">Vos gains apparaissent dès la commande, et deviennent disponibles une fois l\'achat confirmé par la marque. Aucun montant minimum pour retirer.</p></div><div class="frak-card"><h3>Vers votre compte bancaire</h3><p class="frak-muted">Vous transférez quand vous voulez, sans commission. C\'est votre argent, pas des points ni un bon d\'achat.</p></div><div class="frak-card"><h3>Sans donnée bancaire</h3><p class="frak-muted">Pas de RIB à donner pour commencer, pas de mot de passe. Votre porte-monnaie s\'ouvre avec votre biométrie.</p></div></div></section><section class="frak-store"><div style="display:grid;gap:.75em;align-content:start"><h2>Suivez vos gains en temps réel</h2><p class="frak-lede">L\'app Frak vous prévient dès qu\'un ami commande, et centralise vos gains sur toutes les marques partenaires.</p><div class="frak-badges"><a class="frak-badge" data-frak-install href="{INSTALL_URL}"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.7c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.3-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2 2.5 2 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-1 2.4-1.9.8-1.1 1.1-2.2 1.1-2.2 0-.1-2.1-.8-2.1-3.2zM14.5 6.3c.5-.7.9-1.6.8-2.6-.8 0-1.8.6-2.4 1.3-.5.6-1 1.6-.8 2.5.9.1 1.8-.5 2.4-1.2z"/></svg><span><small>Télécharger dans</small><strong>App Store</strong></span></a><a class="frak-badge" data-frak-install href="{INSTALL_URL}"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#34a853" d="M4 21.2 14.3 15l-2.6-2.6z"/><path fill="#ea4335" d="M4 2.8 11.7 11l2.6-2.5z"/><path fill="#fbbc04" d="M18.6 10.2 15 8.2l-2.9 2.8 2.9 2.8 3.6-2c.8-.5.8-1.2 0-1.6z"/><path fill="#4285f4" d="M4 2.8v18.4c0 .5.2.8.6.9l7.5-7.3-7.5-7.3c-.4.2-.6.5-.6 1z"/></svg><span><small>Disponible sur</small><strong>Google Play</strong></span></a></div></div><div class="frak-center"><svg width="118" height="118" viewBox="0 0 29 29" shape-rendering="crispEdges" role="img" aria-label="QR code de téléchargement"><rect width="29" height="29" fill="#fff"/><g fill="#14171c"><path d="M0 0h7v7H0z M2 2h3v3H2z M22 0h7v7h-7z M24 2h3v3h-3z M0 22h7v7H0z M2 24h3v3H2z"/><path d="M9 0h1v3H9z M11 1h1v2h-1z M13 0h1v4h-1z M16 2h1v2h-1z M18 0h1v3h-1zM9 5h2v1H9z M12 5h1v1h-1z M15 5h3v1h-3z M19 4h1v3h-1zM0 9h3v1H0z M4 9h1v2H4z M6 9h2v1H6z M0 12h1v2H0z M2 11h1v3H2z M5 13h2v1H5zM0 16h2v1H0z M3 16h1v2H3z M5 16h1v1H5z M0 19h1v2H0z M2 19h3v1H2z M6 18h1v3H6zM22 9h1v2h-1z M24 9h2v1h-2z M27 10h1v2h-1z M22 13h3v1h-3z M26 13h2v1h-2zM22 16h1v3h-1z M24 17h2v1h-2z M27 16h1v2h-1z M23 20h2v1h-2z M26 19h1v2h-1zM9 9h2v2H9z M12 10h2v1h-2z M15 9h1v3h-1z M17 10h2v2h-2zM9 13h1v2H9z M11 13h3v1h-3z M15 14h2v1h-2z M18 13h1v2h-1zM10 16h2v1h-2z M13 16h1v3h-1z M15 17h3v1h-3z M19 16h1v2h-1zM9 20h3v1H9z M13 21h2v1h-2z M16 20h1v2h-1z M18 21h2v1h-2zM9 24h1v2H9z M11 23h2v1h-2z M14 24h2v1h-2z M17 23h1v3h-1z M19 24h2v1h-2zM9 27h3v1H9z M13 26h1v2h-1z M15 27h2v1h-2z M18 26h2v1h-2zM22 23h2v1h-2z M25 23h1v2h-1z M27 24h1v2h-1z M22 26h1v2h-1z M24 26h3v1h-3z"/></g></svg><p class="frak-muted frak-small">Scannez pour installer</p></div></section><section><h2>Questions fréquentes</h2><details open><summary>C\'est vraiment gratuit ?</summary><p>Oui, totalement. Pas d\'abonnement, pas de frais cachés. Vos gains arrivent dans votre porte-monnaie et vous pouvez les transférer vers votre compte bancaire, sans commission.</p></details><details><summary>Quand est-ce que je reçois mon argent ?</summary><p>À chaque commande générée par votre lien, vos gains sont crédités automatiquement dans votre porte-monnaie Frak. Ils deviennent transférables une fois l\'achat confirmé par la marque, sans montant minimum.</p></details><details><summary>Mes amis paient-ils plus cher avec mon lien ?</summary><p>Non, au contraire. En commandant via votre lien ils reçoivent eux aussi un cashback sur leur achat.</p></details><details><summary>Il faut être influenceur ?</summary><p>Non. Le programme est ouvert à tous nos clients, quelle que soit la taille de votre réseau.</p></details><details><summary>C\'est quoi Frak ?</summary><p>Le partenaire qui gère le suivi des parrainages et le versement des gains pour {BRAND}. Frak ne vend aucune donnée à des tiers.</p></details><p class="frak-center"><a class="frak-cta" data-frak-shop href="{SHOP_URL}">Découvrir la boutique {BRAND}</a></p><p class="frak-muted frak-small frak-center">Programme propulsé par <strong>Frak</strong></p></section></div>';
    const KNOBS = [
        "accent",
        "accent-ink",
        "surface",
        "border",
        "radius",
        "cta-radius",
        "image",
        "h1-size",
        "h1-weight",
        "h1-spacing",
        "h1-color",
        "h2-size",
        "h2-weight",
        "h2-spacing",
        "h2-color",
        "cta-size",
        "cta-weight",
        "cta-spacing",
        "cta-transform",
    ];

    /* Values the component resolves at runtime from SDK config and campaign
       data. The snippet cannot, so they live here and never in the markup:
       a literal amount baked into a template is an amount that ships. */
    const DEMO = { reward: "7,20 €", rewardReferee: "0,80 €", heroImage: null };
    const INSTALL_URL = "https://wallet.frak.id/install";

    /* og:site_name before the hostname: a merchant's own name for itself
       beats whatever their domain happens to spell. */
    const brandName = () =>
        window.FrakSetup?.config?.metadata?.name ||
        document
            .querySelector('meta[property="og:site_name"]')
            ?.getAttribute("content") ||
        location.hostname.replace(/^www\./, "");

    /* The name reaches an alt attribute, and as a replacement string it would
       read $& as a back-reference. */
    const escapeHtml = (value) =>
        value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

    /* A reward that will not resolve falls back to reward-free wording where
       the sentence needs a subject, and takes its node with it where the whole
       sentence lives in the token. Never a placeholder, never a figure nobody
       promised. */
    const fillRewards = (page) => {
        for (const el of page.querySelectorAll(
            "[data-frak-reward],[data-frak-reward-referee]"
        )) {
            const template =
                el.dataset.frakRewardReferee ?? el.dataset.frakReward;
            const value =
                el.dataset.frakRewardReferee === undefined
                    ? DEMO.reward
                    : DEMO.rewardReferee;
            if (value) {
                el.textContent = template.replaceAll("{REWARD}", value);
            } else if (el.dataset.frakNoReward) {
                el.textContent = el.dataset.frakNoReward;
            } else {
                el.remove();
            }
        }
        /* No source means no <img>: a broken icon reads worse than no art. */
        const hero = page.querySelector("[data-frak-hero]");
        if (!hero) return;
        if (DEMO.heroImage) hero.src = DEMO.heroImage;
        else hero.remove();
    };

    /* Built from the rendered FAQ so the markup stays the one source.
       Injected client-side it is inert for crawlers; it exists so the
       server-rendered port has the exact shape to emit. */
    const mountFaqSchema = (page) => {
        const mainEntity = [...page.querySelectorAll("details")]
            .map((item) => ({
                "@type": "Question",
                name: item.querySelector("summary")?.textContent?.trim(),
                acceptedAnswer: {
                    "@type": "Answer",
                    text: item.querySelector("p")?.textContent?.trim(),
                },
            }))
            .filter((q) => q.name && q.acceptedAnswer.text);
        if (!mainEntity.length) return 0;
        const ld = document.createElement("script");
        ld.type = "application/ld+json";
        ld.id = "frak-amb-faq";
        ld.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity,
        });
        document.head.appendChild(ld);
        return mainEntity.length;
    };

    /* Classes that exist for scripts, not for looks. */
    const BLOCKED =
        /^(js-|needsclick|swiper|gtm|ga-|fb-|track|lazy|no-js|data-)/i;
    /* A class that can move a box is never adopted. */
    const LAYOUT =
        /^(position|display|width|min-width|max-width|height|min-height|max-height|margin|float|grid|flex|inset|top|left|right|bottom|transform|overflow)/;
    const TYPO =
        /^(font|letter-spacing|text-transform|text-decoration|color|line-height|white-space)/;

    /* Site chrome is never ours to replace. Two discriminators, both measured
       across the brand sweep: a <header> inside the main content region is a
       card's rather than the site's (depth 11), and where a theme ships no
       <main> the site's own sits shallow (depths 1-4). */
    const CHROME =
        "header, footer, [role=banner], [role=contentinfo], .skip-link";
    const MAIN = "main, [role=main], #main";
    const CHROME_MAX_DEPTH = 4;

    const depthFromBody = (el) => {
        let depth = 0;
        let node = el;
        while (node && node !== document.body) {
            depth += 1;
            node = node.parentElement;
        }
        return depth;
    };

    const siteChrome = () =>
        [...document.querySelectorAll(CHROME)].filter(
            (el) => !el.closest(MAIN) && depthFromBody(el) <= CHROME_MAX_DEPTH
        );

    /* Descend through a wrapper holding both chrome and content rather than
       hiding it whole: Divi nests its header three levels below <body>. */
    const collectContent = (parent, chrome, out) => {
        for (const el of parent.children) {
            // The SDK mounts IFRAME#frak-wallet as a body child, so the body
            // fallback would hide the live wallet along with the page.
            if (el.id.startsWith("frak-")) continue;
            if (chrome.includes(el)) continue;
            if (chrome.some((node) => el.contains(node))) {
                collectContent(el, chrome, out);
                continue;
            }
            out.push({ el, display: el.style.display });
        }
    };

    /* Where the content began, so chrome above and below keeps its place. */
    const anchorFor = (chrome, hidden) => {
        const banner = chrome.find((el) => el.matches("header, [role=banner]"));
        const below =
            banner &&
            hidden.find(
                ({ el }) =>
                    banner.compareDocumentPosition(el) &
                    Node.DOCUMENT_POSITION_FOLLOWING
            );
        return below || hidden[0] || null;
    };

    let saved = null;

    const remove = () => {
        document.getElementById("frak-amb-css")?.remove();
        document.getElementById("frak-amb-block")?.remove();
        document.getElementById("frak-amb-faq")?.remove();
        if (saved) {
            saved.hidden.forEach(({ el, display }) => {
                el.style.display = display;
                delete el.dataset.frakHidden;
            });
            saved = null;
        }
    };

    /* Computed colours arrive as rgb(), rgba() or color(srgb ... / a). */
    const alphaOf = (v) => {
        const slash = /\/\s*([\d.]+)(%?)\s*\)/.exec(v);
        if (slash) return +slash[1] / (slash[2] ? 100 : 1);
        const p = (v || "").match(/[\d.]+/g);
        if (!p) return 0;
        return /^rgba/.test(v) && p.length >= 4 ? +p[3] : 1;
    };

    /* A sample that renders as nothing must never be written as a knob. */
    const isTransparent = (v) => {
        if (!v || v === "transparent") return true;
        return /^(rgba?|color)\(/.test(v) && alphaOf(v) === 0;
    };

    const rgbOf = (v) => {
        const p = ((v || "").match(/[\d.]+/g) || []).map(Number);
        if (p.length < 3) return [0, 0, 0];
        /* color(srgb ...) carries 0-1 channels; everything else is 0-255. */
        const scale = /^color\(/.test(v) ? 255 : 1;
        return [p[0] * scale, p[1] * scale, p[2] * scale];
    };
    const dist = (x, y) => {
        const [a1, b1, c1] = rgbOf(x),
            [a2, b2, c2] = rgbOf(y);
        return Math.hypot(a1 - a2, b1 - b2, c1 - c2);
    };
    const lum = (v) => {
        const ch = (n) => {
            const s = n / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        const [r, g, b] = rgbOf(v);
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    };
    const contrast = (x, y) => {
        const [hi, lo] = [lum(x), lum(y)].sort((m, n) => n - m);
        return (hi + 0.05) / (lo + 0.05);
    };
    /* Flatten a translucent colour onto the opaque one beneath it. */
    const over = (fg, bg) => {
        const a = alphaOf(fg);
        if (a >= 1) return fg;
        const [r1, g1, b1] = rgbOf(fg),
            [r2, g2, b2] = rgbOf(bg);
        const mix = (x, y) => x * a + y * (1 - a);
        return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
    };
    const pageBackground = () => {
        let n = document.body;
        while (n) {
            const bg = getComputedStyle(n).backgroundColor;
            if (!isTransparent(bg)) return bg;
            n = n.parentElement;
        }
        return "rgb(255, 255, 255)";
    };
    /* A fill this close to the page cannot read as a button. */
    const FLAT_FILL = 30;
    /* Under this WCAG ratio a sampled text colour is unreadable on our backdrop. */
    const READABLE = 3;

    /* Noms communs, jamais de marques : un widget nommé dans sa seule langue
       maison passe au travers, d'où la structure d'abord. */
    const WIDGET_WORDS =
        /cookie|consent|newsletter|popup|modal|sr-only|visually-hidden|skip-to/i;
    const names = (el) => `${el.getAttribute("class") || ""} ${el.id}`;
    const inCartForm = (el) =>
        el.closest('form[action*="/cart"], form[action*="/panier"]') !== null;

    /* Un formulaire qui demande une adresse est une inscription, quel qu'en
       soit l'éditeur. Divi nomme le champ sans lui donner de type. */
    const inSignupForm = (el) => {
        const form = el.closest("form");
        if (!form || inCartForm(el)) return false;
        return (
            form.querySelector(
                'input[type="email"], input[name*="email" i]'
            ) !== null
        );
    };

    const isOverlayBox = (el) => {
        const role = el.getAttribute("role");
        if (
            el.tagName === "DIALOG" ||
            role === "dialog" ||
            role === "alertdialog"
        )
            return true;
        if (el.getAttribute("aria-modal") === "true") return true;
        return getComputedStyle(el).position === "fixed";
    };

    /* S'arrête sous <body> : les bandeaux de consentement posent une classe
       d'état sur la racine, qui rejetterait alors tous les boutons. */
    const insideWidget = (el) => {
        if (inSignupForm(el)) return true;
        const cart = inCartForm(el);
        let node = el;
        while (node && node !== document.body) {
            if (WIDGET_WORDS.test(names(node))) return true;
            if (!cart && isOverlayBox(node)) return true;
            node = node.parentElement;
        }
        return false;
    };

    /* Le premier ancêtre peint, pas la page : un bouton pâle sur un panneau
       pâle reste plat même si le corps derrière eux est blanc. */
    const backdropOf = (el) => {
        let node = el.parentElement;
        while (node) {
            const bg = getComputedStyle(node).backgroundColor;
            if (!isTransparent(bg)) return bg;
            node = node.parentElement;
        }
        return pageBackground();
    };

    /* Garé hors-cadre : c'est ainsi qu'un tiroir fermé cache un vrai CTA qui
       mesure pourtant sa taille pleine. */
    const isOnScreen = (el) => {
        const r = el.getBoundingClientRect();
        return r.right > 0 && r.left < window.innerWidth;
    };

    /* Readable brand: laid out, not hidden, and unlike the page behind it. */
    const isBrandButton = (el) => {
        if (insideWidget(el)) return false;
        if (el.offsetWidth < 80 || el.offsetHeight < 20) return false;
        if (!isOnScreen(el)) return false;
        const st = getComputedStyle(el);
        if (st.visibility === "hidden") return false;
        if (isTransparent(st.backgroundColor)) return false;
        return dist(st.backgroundColor, backdropOf(el)) > FLAT_FILL;
    };

    /* Une classe qui peut bouger une boîte n'est jamais adoptée : le rayon
       vient des contenants discrets, jamais d'un état sélectionné dont la
       bordure crie contre le fond de la page. À mesurer avant le masquage du
       contenu d'origine, sinon chaque rect vaut zéro. */
    const quietRadius = (el, pageBg) => {
        const r = el.getBoundingClientRect();
        if (r.width < 120 || r.height < 60 || r.width * r.height > 500000)
            return null;
        const st = getComputedStyle(el);
        if (st.position === "fixed" || st.position === "sticky") return null;
        const bordered =
            parseFloat(st.borderTopWidth) > 0 &&
            !isTransparent(st.borderTopColor);
        const filled =
            !isTransparent(st.backgroundColor) && st.backgroundColor !== pageBg;
        if (!bordered && !filled) return null;
        if (bordered && dist(st.borderTopColor, pageBg) > 120) return null;
        return st.borderTopLeftRadius;
    };

    const censusRadius = () => {
        const pageBg = pageBackground();
        const tally = {};
        for (const el of document.querySelectorAll(
            "div,section,article,li,label"
        )) {
            const radius = quietRadius(el, pageBg);
            if (radius) tally[radius] = (tally[radius] || 0) + 1;
        }
        const ranked = Object.entries(tally).sort((x, y) => y[1] - x[1]);
        return ranked.length ? ranked[0][0] : null;
    };

    const mount = (selector, replace = true) => {
        remove();

        const style = document.createElement("style");
        style.id = "frak-amb-css";
        style.textContent = CSS;
        document.head.appendChild(style);

        const block = document.createElement("section");
        block.id = "frak-amb-block";
        block.style.cssText =
            "max-width:1100px;margin:60px auto;padding:0 20px";
        const brand = escapeHtml(brandName());
        const markup = HTML.replaceAll("{BRAND}", () => brand)
            .replaceAll("{INSTALL_URL}", INSTALL_URL)
            .replaceAll("{SHOP_URL}", `${location.origin}/`);
        block.append(
            ...new DOMParser().parseFromString(markup, "text/html").body
                .childNodes
        );

        const page = block.firstElementChild;
        fillRewards(page);
        const faqCount = mountFaqSchema(page);
        const mine = (el) => page.contains(el);
        const set = (k, v) => {
            page.style.setProperty(`--frak-amb-${k}`, v);
            return `${k} → ${v}`;
        };
        const host =
            (selector && document.querySelector(selector)) ||
            document.querySelector("#main") ||
            document.querySelector("main") ||
            document.body;

        /* Chrome headings and wordmarks are not content headings. */
        const isContentHeading = (el) => {
            if (el.closest("header,nav,[role=banner]")) return false;
            return !/logo|brand|site-title|wordmark/i.test(
                `${el.className} ${el.id}`
            );
        };

        /* A hidden heading is still their typography, but chrome never is:
           sampling nothing leaves our own clamp() in place. */
        const hostEl = (sel) => {
            const theirs = [...document.querySelectorAll(sel)].filter(
                (el) => !mine(el)
            );
            const visible = theirs.filter((el) => el.offsetHeight > 0);
            return (
                visible.find(isContentHeading) || theirs.find(isContentHeading)
            );
        };

        const primaryButton = () => {
            const cart = document.querySelector(
                'form[action*="/cart/add"] [type=submit], form[action*="/cart"] button[type=submit]'
            );
            if (cart && !mine(cart) && isBrandButton(cart)) return cart;
            const theirs = [
                ...document.querySelectorAll(
                    "button, .btn, [type=submit], a.button, a.wp-block-button__link, a.et_pb_button"
                ),
            ].filter((el) => !mine(el) && isBrandButton(el));
            return (
                theirs.sort(
                    (x, y) =>
                        y.offsetWidth * y.offsetHeight -
                        x.offsetWidth * x.offsetHeight
                )[0] || null
            );
        };

        const typo = (el, role, backdrop) => {
            if (!el) return [];
            const s = getComputedStyle(el);
            const knobs = [
                [`${role}-size`, s.fontSize],
                [`${role}-weight`, s.fontWeight],
                [`${role}-spacing`, s.letterSpacing],
            ];
            /* A colour chosen for the merchant's backdrop can vanish on ours. */
            if (contrast(over(s.color, backdrop), backdrop) >= READABLE) {
                knobs.push([`${role}-color`, s.color]);
            }
            return knobs;
        };

        const writeKnobs = (knobs) => {
            let written = 0;
            for (const [k, v] of knobs) {
                if (!v || isTransparent(v)) continue;
                set(k, v);
                written += 1;
            }
            return written;
        };

        const buttonKnobs = (button) => {
            if (!button) return [];
            const f = getComputedStyle(button);
            return [
                ["accent", f.backgroundColor],
                ["accent-ink", f.color],
                ["cta-radius", f.borderRadius.split(" ")[0]],
                ["cta-transform", f.textTransform],
            ];
        };

        /* Chooses what to copy. Layout-dependent, so it must run before the
           host content is hidden: a hidden element measures zero. */
        const sampleHost = () => {
            const pageBg = pageBackground();
            const button = primaryButton();
            return {
                pageBg,
                buttonBg: button
                    ? getComputedStyle(button).backgroundColor
                    : pageBg,
                h1: hostEl("h1"),
                h2: hostEl("h2"),
                button,
                radius: censusRadius(),
            };
        };

        /* Re-reads the remembered elements: hidden or not, they are theirs. */
        const knobsFrom = (src) => [
            ...typo(src.h1, "h1", src.pageBg),
            ...typo(src.h2, "h2", src.pageBg),
            ...typo(src.button, "cta", src.buttonBg),
            ...buttonKnobs(src.button),
            ...(src.radius ? [["radius", src.radius]] : []),
        ];

        const applyTheme = (src) => {
            const written = writeKnobs(knobsFrom(src));
            return (
                written +
                " valeurs échantillonnées" +
                (src.button ? "" : " (aucun bouton trouvé)")
            );
        };

        /* Layout is measured here, while the host content is still laid out. */
        const sample = sampleHost();
        const autoTheme = () => applyTheme(sample);

        let anchor = null;
        if (replace) {
            const chrome = siteChrome();
            const hidden = [];
            collectContent(host, chrome, hidden);
            hidden.forEach(({ el }) => {
                el.style.display = "none";
                el.dataset.frakHidden = "1";
            });
            saved = { hidden };
            anchor = anchorFor(chrome, hidden);
        }
        (anchor ? anchor.el.parentElement : host).insertBefore(
            block,
            anchor ? anchor.el : null
        );

        window.scrollTo({
            top: Math.max(
                0,
                block.getBoundingClientRect().top + window.scrollY - 40
            ),
            behavior: "smooth",
        });

        /* The host's own content may be deliberately pulled under a sticky header
       (oolution sets #MainContent{margin-top:-120px}); we have no hero to
       absorb that, so measure the pinned chrome and clear it. */
        const fitBelowHeader = () => {
            const pinned = [
                ...document.querySelectorAll(
                    "header, [class*=header], [id*=header], [id*=nav], [class*=nav]"
                ),
            ]
                .filter((el) => !mine(el))
                .map((el) => {
                    const st = getComputedStyle(el);
                    if (st.position !== "fixed" && st.position !== "sticky")
                        return 0;
                    const r = el.getBoundingClientRect();
                    /* Pinned chrome rarely starts at 0: an announcement bar usually sits
             above it. Anything pinned in the top third counts. */
                    const pinnedToTop = r.top < innerHeight / 3 && r.bottom > 0;
                    return pinnedToTop &&
                        r.height > 0 &&
                        r.height < innerHeight / 2
                        ? r.bottom
                        : 0;
                })
                .reduce((a, b) => Math.max(a, b), 0);

            const was = window.scrollY;
            window.scrollTo(0, 0);
            const top = block.getBoundingClientRect().top;
            const gap = pinned - top;
            if (gap > 0) {
                const current =
                    parseFloat(getComputedStyle(block).marginTop) || 0;
                block.style.marginTop = `${Math.round(current + gap + 24)}px`;
            }
            window.scrollTo(0, was);
            return gap > 0
                ? `dégagé de ${Math.round(gap + 24)}px`
                : "aucun dégagement nécessaire";
        };

        /* --- 3b : adoption de classes, sous conditions --- */
        const rulesFor = (cls) =>
            [...document.styleSheets]
                .flatMap((s) => {
                    try {
                        return [...s.cssRules];
                    } catch {
                        return [];
                    }
                })
                .filter((r) =>
                    r.selectorText
                        ?.split(",")
                        .some((sel) => sel.includes(`.${cls}`))
                );

        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: idem
        const adoptable = (cls) => {
            if (BLOCKED.test(cls)) return false;
            const rules = rulesFor(cls);
            if (!rules.length) return false;
            let typographic = false;
            for (const r of rules) {
                for (const prop of [...r.style]) {
                    if (LAYOUT.test(prop)) return false;
                    if (TYPO.test(prop)) typographic = true;
                }
            }
            return typographic;
        };

        const undoClone = () => {
            page.querySelectorAll("[data-frak-cloned]").forEach((el) => {
                el.classList.remove(...el.dataset.frakCloned.split(" "));
                delete el.dataset.frakCloned;
            });
            return "classes retirées";
        };

        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: idem
        const cloneClasses = () => {
            undoClone();
            const before = block.scrollHeight;
            const report = [];
            for (const tag of ["h1", "h2"]) {
                const source = hostEl(tag);
                if (!source) continue;
                const classes = String(source.className || "")
                    .split(/\s+/)
                    .filter(Boolean)
                    .filter(adoptable);
                if (!classes.length) {
                    report.push(`${tag} : aucune classe adoptable`);
                    continue;
                }
                page.querySelectorAll(tag).forEach((el) => {
                    el.dataset.frakCloned = classes.join(" ");
                    el.classList.add(...classes);
                });
                report.push(`${tag} ← ${classes.join(" ")}`);
            }
            const after = block.scrollHeight;
            if (after > before * 2 || after < before / 2) {
                undoClone();
                return `annulé : hauteur ${before}px → ${after}px`;
            }
            return report.join(" | ") || "rien à adopter";
        };

        const reset = () => {
            KNOBS.forEach((k) => {
                page.style.removeProperty(`--frak-amb-${k}`);
            });
            undoClone();
            return "valeurs par défaut";
        };

        const fitted = replace ? fitBelowHeader() : "mode ajout";

        let t;
        window.addEventListener("resize", () => {
            clearTimeout(t);
            t = setTimeout(autoTheme, 200);
        });

        window.__frakAmb = {
            remove,
            set,
            reset,
            autoTheme,
            cloneClasses,
            undoClone,
            fitBelowHeader,
            el: page,
            into: (s) => mount(s, true),
            append: (s) => mount(s, false),
            accent: (c) => set("accent", c),
        };

        const where =
            "<" +
            host.tagName.toLowerCase() +
            (host.id ? `#${host.id}` : "") +
            ">";
        return (
            (replace
                ? `Contenu de ${where} remplacé`
                : `Ajouté dans ${where}`) +
            ". " +
            autoTheme() +
            ". " +
            fitted +
            `. ${faqCount} questions en FAQPage` +
            ". __frakAmb.cloneClasses() pour tenter les classes du thème, .remove() pour restaurer."
        );
    };

    return mount();
})();
