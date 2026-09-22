/* Frak — page ambassadeur (direction K) à coller dans la console d'une
 * boutique marchande : remplace le contenu principal, en-tête et pied restent,
 * auto-theme immédiat sur la page hôte. __frakAmb.remove() restaure le contenu
 * d'origine ; aussi disponibles : autoTheme, cloneClasses/undoClone, reset,
 * set('accent', '#c0392b'). */
(() => {
    const CSS =
        '[data-frak-page]{--_accent:var(--frak-amb-accent,#111);--_ink:var(--frak-amb-accent-ink,#fff);--_surface:var(--frak-amb-surface,rgba(17,17,17,.04));--_border:var(--frak-amb-border,rgba(17,17,17,.15));--_radius:var(--frak-amb-radius,12px);--_cta-radius:var(--frak-amb-cta-radius,999px);--_cta-bg:var(--frak-amb-cta-bg,var(--_accent));--_tag-bg:var(--frak-amb-tag-bg,#fff);display:grid;gap:clamp(3em,7vw,5.5em);}@supports (color: color-mix(in srgb, red 4%, transparent)){[data-frak-page]{--_surface:var(--frak-amb-surface,color-mix(in srgb,var(--_accent) 4%,transparent));--_border:var(--frak-amb-border,color-mix(in srgb,var(--_accent) 15%,transparent));}}[data-frak-page] section{display:grid;gap:.85em;align-content:start}:where([data-frak-page]) h1{font-size:var(--frak-amb-h1-size,clamp(2em,4.6vw,3.2em));font-weight:var(--frak-amb-h1-weight,inherit);letter-spacing:var(--frak-amb-h1-spacing,normal);color:var(--frak-amb-h1-color,inherit);line-height:1.1;margin:0}:where([data-frak-page]) h2{font-size:var(--frak-amb-h2-size,clamp(1.4em,2.6vw,2em));font-weight:var(--frak-amb-h2-weight,inherit);letter-spacing:var(--frak-amb-h2-spacing,normal);color:var(--frak-amb-h2-color,inherit);line-height:1.2;margin:0}:where([data-frak-page]) h3{font-size:1.05em;line-height:1.3;margin:0}:where([data-frak-page]) p{margin:0}.frak-center{text-align:center;justify-items:center}.frak-lede{max-width:52ch;opacity:.75}.frak-center .frak-lede{margin-inline:auto}.frak-muted{opacity:.7}.frak-small{font-size:.85em}.frak-cta{display:inline-flex;align-items:center;justify-content:center;background:var(--_cta-bg);color:var(--_ink);border:0;border-radius:var(--_cta-radius);padding:.95em 2em;font:inherit;font-size:var(--frak-amb-cta-size,.9em);font-weight:var(--frak-amb-cta-weight,700);letter-spacing:var(--frak-amb-cta-spacing,.06em);text-transform:var(--frak-amb-cta-transform,uppercase);cursor:pointer;text-decoration:none}.frak-cta:hover{opacity:.85}.frak-cta:disabled{opacity:.5;cursor:default}.frak-cols{display:grid;gap:1.25em;grid-template-columns:repeat(auto-fit,minmax(15em,1fr))}.frak-card{display:grid;gap:.5em;align-content:start;background:var(--_surface);border:1px solid var(--_border);border-radius:var(--_radius);padding:1.4em}.frak-step{inline-size:1.9em;block-size:1.9em;display:grid;place-items:center;margin:0;border-radius:var(--_cta-radius);background:var(--_accent);color:var(--_ink);font-weight:700;font-size:.9em}.frak-amount{display:block;font-size:clamp(3.5em,14vw,7em);line-height:.85;margin-block-end:.12em;font-weight:800;letter-spacing:-.04em;color:var(--_accent)}.frak-art-img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover;border-radius:var(--_radius)}.frak-hero{display:grid;gap:2.5em;grid-template-columns:repeat(auto-fit,minmax(18em,1fr));align-items:center}.frak-hero>div:not(.frak-art){display:grid;gap:1em;align-content:start;justify-items:start}.frak-art{position:relative;aspect-ratio:4/5;border-radius:var(--_radius);display:grid;place-items:center;text-align:center;padding:1em;background:var(--frak-amb-image,var(--_surface)) center/cover;border:1px solid var(--_border)}.frak-tag{position:absolute;inset:auto 1em 1em;display:flex;flex-wrap:wrap;align-items:center;gap:.75em;text-align:start;background:var(--_tag-bg);border-radius:var(--_radius);padding:.9em 1em}.frak-tag b{display:block;font-size:1.4em;line-height:1.1;color:var(--_accent)}.frak-tag small{display:block;font-size:.8em;opacity:.7}.frak-pill{margin-inline-start:auto;background:var(--_accent);color:var(--_ink);border-radius:var(--_cta-radius);padding:.45em .8em;font-size:.72em;font-weight:700;letter-spacing:.04em}.frak-faces{display:flex;flex-wrap:wrap;gap:.6em;align-items:center}.frak-faces span{inline-size:2.2em;block-size:2.2em;border-radius:50%;display:grid;place-items:center;font-size:.75em;font-weight:700;background:var(--_accent);color:var(--_ink)}[data-frak-page] :focus-visible{outline:2px solid currentColor!important;outline-offset:2px!important}.frak-badges{display:flex;flex-wrap:wrap;gap:.75em;align-items:center}.frak-badge{display:inline-flex;text-decoration:none}.frak-badge>*{display:block;height:40px!important;width:auto!important;max-width:none!important;border:0!important;box-shadow:none!important}.frak-store{display:grid;gap:1.75em;grid-template-columns:repeat(auto-fit,minmax(14em,1fr));align-items:center;background:var(--_surface);border:1px solid var(--_border);border-radius:var(--_radius);padding:1.75em}[data-frak-page] details{border-bottom:1px solid var(--_border);padding:.9em 0}[data-frak-page] summary{cursor:pointer;font-weight:700;list-style:none}[data-frak-page] summary::-webkit-details-marker{display:none}[data-frak-page] summary::after{content:"+";float:right;color:var(--_accent);font-weight:700}[data-frak-page] details[open] summary::after{content:"–"}[data-frak-page] details p{margin-top:.6em;opacity:.75}.frak-link{color:inherit;text-decoration:underline;text-underline-offset:.15em}';
    const HTML =
        '<div data-frak-page lang="fr"><section class="frak-hero"><div><p class="frak-muted frak-small">Programme ambassadeur</p><h1>Devenez ambassadeur de {BRAND}.</h1><p class="frak-lede">Vous parlez déjà de {BRAND} autour de vous. Nous vous en remercions&nbsp;: une récompense sur chaque commande que vous inspirez, et quelques attentions réservées à nos ambassadeurs.</p><button type="button" class="frak-cta" data-frak-share>Devenir ambassadeur</button><div class="frak-faces"><p class="frak-muted frak-small">Rejoignez les ambassadrices et ambassadeurs de la marque</p></div></div><div class="frak-art"><img data-frak-hero alt="Ambassadrices et ambassadeurs {BRAND}" class="frak-art-img"><div class="frak-tag"><div><b data-frak-reward="{REWARD}" data-frak-no-reward="Une récompense">{REWARD}</b> <small>pour vous, par commande</small></div> <span class="frak-pill" data-frak-reward-referee="+ {REWARD} offerts à votre filleul">+ {REWARD} offerts à votre filleul</span></div></div></section><section class="frak-center"><p class="frak-muted frak-small">Programme de parrainage</p><h2><span class="frak-amount" data-frak-reward="{REWARD}" data-frak-no-reward="Une récompense">{REWARD}</span> pour vous, à chaque ami qui commande.</h2><p class="frak-muted frak-small">Estimation&nbsp;: le montant dépend de la campagne et du panier de votre proche.</p><p class="frak-lede">Pas de plafond, pas de montant minimum. Vous partagez ce que vous aimez déjà, vous êtes payé quand ça marche.</p><button type="button" class="frak-cta" data-frak-share>Obtenir mon lien</button><p class="frak-muted frak-small">Gratuit · sans engagement · versé sur votre compte bancaire</p></section><section><h2>Vous recommandez déjà {BRAND}. Il manque juste le lien.</h2><p class="frak-lede">Un message à une amie, une réponse dans un groupe, une adresse donnée au dîner&nbsp;: ces commandes existent déjà. Elles ne sont simplement rattachées à personne.</p><p class="frak-muted">Votre lien ne change pas votre façon de recommander&nbsp;; il rend la recommandation identifiable, pour que la commande qui en découle vous revienne. Un créateur touche une commission sur une vente. Vous touchez la même chose sur la vôtre, quelle que soit la taille de votre audience.</p></section><section><h2>Comment devenir ambassadeur {BRAND}</h2><p class="frak-lede">Trois gestes, rien de plus.</p><div class="frak-cols"><div class="frak-card"><p class="frak-step" aria-hidden="true">1</p><h3>Je partage</h3><p class="frak-muted">Vous transmettez votre lien à qui vous voulez&nbsp;: de bouche à oreille, en story ou par message.</p></div><div class="frak-card"><p class="frak-step" aria-hidden="true">2</p><h3>J’installe</h3><p class="frak-muted">Votre ami installe l’app Frak en quelques secondes, et bénéficie lui aussi d’un avantage sur sa commande.</p></div><div class="frak-card"><p class="frak-step" aria-hidden="true">3</p><h3>Je récupère mon argent</h3><p class="frak-muted">Dès qu’il commande, vos gains arrivent dans votre porte-monnaie Frak, prêts à être transférés quand vous le souhaitez.</p></div></div></section><section><h2>Comment vous êtes payé</h2><p class="frak-lede">La question que tout le monde se pose en premier.</p><div class="frak-cols"><div class="frak-card"><h3>Crédité instantanément</h3><p class="frak-muted">Vos gains apparaissent dès la commande, et deviennent disponibles une fois l\'achat confirmé par la marque. Aucun montant minimum pour retirer.</p></div><div class="frak-card"><h3>Vers votre compte bancaire</h3><p class="frak-muted">Vous transférez quand vous voulez, sans commission. C\'est votre argent, pas des points ni un bon d\'achat.</p></div><div class="frak-card"><h3>Sans donnée bancaire</h3><p class="frak-muted">Pas de RIB à donner pour commencer, pas de mot de passe. Votre porte-monnaie s\'ouvre avec votre biométrie.</p></div></div></section><section class="frak-store"><div style="display:grid;gap:.75em;align-content:start"><h2>Suivez vos gains en temps réel</h2><p class="frak-lede">L\'app Frak vous prévient dès qu\'un ami commande, et centralise vos gains sur toutes les marques partenaires.</p><div class="frak-badges"><a class="frak-badge" data-frak-install href="{INSTALL_URL}" aria-label="Télécharger dans l’App Store"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 126.50751 40"><g><g><path d="M116.97821,0H9.53468c-.3667,0-.729,0-1.09473.002-.30615.002-.60986.00781-.91895.0127A13.21476,13.21476,0,0,0,5.5171.19141a6.66509,6.66509,0,0,0-1.90088.627A6.43779,6.43779,0,0,0,1.99757,1.99707,6.25844,6.25844,0,0,0,.81935,3.61816a6.60119,6.60119,0,0,0-.625,1.90332,12.993,12.993,0,0,0-.1792,2.002C.00587,7.83008.00489,8.1377,0,8.44434V31.5586c.00489.3105.00587.6113.01515.9219a12.99232,12.99232,0,0,0,.1792,2.0019,6.58756,6.58756,0,0,0,.625,1.9043A6.20778,6.20778,0,0,0,1.99757,38.001a6.27445,6.27445,0,0,0,1.61865,1.1787,6.70082,6.70082,0,0,0,1.90088.6308,13.45514,13.45514,0,0,0,2.0039.1768c.30909.0068.6128.0107.91895.0107C8.80567,40,9.168,40,9.53468,40H116.97821c.3594,0,.7246,0,1.084-.002.3047,0,.6172-.0039.9219-.0107a13.279,13.279,0,0,0,2-.1768,6.80432,6.80432,0,0,0,1.9082-.6308,6.27742,6.27742,0,0,0,1.6172-1.1787,6.39482,6.39482,0,0,0,1.1816-1.6143,6.60413,6.60413,0,0,0,.6191-1.9043,13.50641,13.50641,0,0,0,.1856-2.0019c.0039-.3106.0039-.6114.0039-.9219.0078-.3633.0078-.7246.0078-1.0938V9.53613c0-.36621,0-.72949-.0078-1.09179,0-.30664,0-.61426-.0039-.9209a13.50709,13.50709,0,0,0-.1856-2.002,6.6177,6.6177,0,0,0-.6191-1.90332,6.46619,6.46619,0,0,0-2.7988-2.7998,6.76753,6.76753,0,0,0-1.9082-.627,13.04394,13.04394,0,0,0-2-.17676c-.3047-.00488-.6172-.01074-.9219-.01269-.3594-.002-.7246-.002-1.084-.002Z" style="fill: #a6a6a6"/><path d="M8.44482,39.125c-.30467,0-.602-.0039-.90428-.0107a12.68714,12.68714,0,0,1-1.86914-.1631,5.88381,5.88381,0,0,1-1.65674-.5479,5.40573,5.40573,0,0,1-1.397-1.0166,5.32082,5.32082,0,0,1-1.02051-1.3965,5.72186,5.72186,0,0,1-.543-1.6572,12.41351,12.41351,0,0,1-.1665-1.875c-.00634-.2109-.01464-.9131-.01464-.9131V8.44434S.88185,7.75293.8877,7.5498a12.37138,12.37138,0,0,1,.16552-1.87207,5.75577,5.75577,0,0,1,.54347-1.6621A5.37365,5.37365,0,0,1,2.61182,2.61768,5.56562,5.56562,0,0,1,4.01417,1.59521a5.82309,5.82309,0,0,1,1.65332-.54394A12.58579,12.58579,0,0,1,7.543.88721L8.44532.875h109.612l.9131.0127a12.38493,12.38493,0,0,1,1.8584.16259,5.93833,5.93833,0,0,1,1.6709.54785,5.59375,5.59375,0,0,1,2.415,2.41993,5.76267,5.76267,0,0,1,.5352,1.64892,12.995,12.995,0,0,1,.1738,1.88721c.0029.2832.0029.5874.0029.89014.0079.375.0079.73193.0079,1.09179V30.4648c0,.3633,0,.7178-.0079,1.0752,0,.3252,0,.6231-.0039.9297a12.73126,12.73126,0,0,1-.1709,1.8535,5.739,5.739,0,0,1-.54,1.67,5.48029,5.48029,0,0,1-1.0156,1.3857,5.4129,5.4129,0,0,1-1.3994,1.0225,5.86168,5.86168,0,0,1-1.668.5498,12.54218,12.54218,0,0,1-1.8692.1631c-.2929.0068-.5996.0107-.8974.0107l-1.084.002Z"/></g><g><g id="_Group_" data-name="&lt;Group&gt;"><g id="_Group_2" data-name="&lt;Group&gt;"><g id="_Group_3" data-name="&lt;Group&gt;"><path id="_Path_" data-name="&lt;Path&gt;" d="M24.7718,20.30068a4.94881,4.94881,0,0,1,2.35656-4.15206,5.06566,5.06566,0,0,0-3.99116-2.15768c-1.67924-.17626-3.30719,1.00483-4.1629,1.00483-.87227,0-2.18977-.98733-3.6085-.95814a5.31529,5.31529,0,0,0-4.47292,2.72787c-1.934,3.34842-.49141,8.26947,1.3612,10.97608.9269,1.32535,2.01018,2.8058,3.42763,2.7533,1.38706-.05753,1.9051-.88448,3.5794-.88448,1.65876,0,2.14479.88448,3.591.8511,1.48838-.02416,2.42613-1.33124,3.32051-2.66914A10.962,10.962,0,0,0,27.691,24.69985,4.78205,4.78205,0,0,1,24.7718,20.30068Z" style="fill: #fff"/><path id="_Path_2" data-name="&lt;Path&gt;" d="M22.04017,12.21089a4.87248,4.87248,0,0,0,1.11452-3.49062,4.95746,4.95746,0,0,0-3.20758,1.65961,4.63634,4.63634,0,0,0-1.14371,3.36139A4.09905,4.09905,0,0,0,22.04017,12.21089Z" style="fill: #fff"/></g></g></g><g id="_Group_4" data-name="&lt;Group&gt;"><g><path d="M35.65528,14.70166V9.57813h-1.877V8.73486h4.67676v.84326H36.582v5.12354Z" style="fill: #fff"/><path d="M42.76466,13.48584a1.828,1.828,0,0,1-1.95117,1.30273,2.04531,2.04531,0,0,1-2.08008-2.32422,2.07685,2.07685,0,0,1,2.07617-2.35254c1.25293,0,2.00879.856,2.00879,2.27v.31006H39.63868v.0498a1.1902,1.1902,0,0,0,1.19922,1.29,1.07934,1.07934,0,0,0,1.07129-.5459Zm-3.126-1.45117H41.9131a1.08647,1.08647,0,0,0-1.1084-1.1665A1.15162,1.15162,0,0,0,39.63868,12.03467ZM40.2754,9.4458l1.03809-1.42236h1.042L41.19337,9.4458Z" style="fill: #fff"/><path d="M44.05274,8.44092h.88867v6.26074h-.88867Z" style="fill: #fff"/><path d="M50.208,13.48584a1.828,1.828,0,0,1-1.95117,1.30273,2.04531,2.04531,0,0,1-2.08008-2.32422,2.07685,2.07685,0,0,1,2.07617-2.35254c1.25293,0,2.00879.856,2.00879,2.27v.31006H47.082v.0498a1.1902,1.1902,0,0,0,1.19922,1.29,1.07934,1.07934,0,0,0,1.07129-.5459Zm-3.126-1.45117h2.27441a1.08647,1.08647,0,0,0-1.1084-1.1665A1.15162,1.15162,0,0,0,47.082,12.03467Zm.63672-2.58887,1.03809-1.42236h1.042L48.63673,9.4458Z" style="fill: #fff"/><path d="M54.40333,11.67041a1.00546,1.00546,0,0,0-1.06348-.76465c-.74414,0-1.19922.57031-1.19922,1.52979,0,.97607.459,1.55908,1.19922,1.55908a.97873.97873,0,0,0,1.06348-.74023h.86426a1.762,1.762,0,0,1-1.92285,1.53418,2.06791,2.06791,0,0,1-2.11328-2.353,2.05305,2.05305,0,0,1,2.1084-2.32373,1.77731,1.77731,0,0,1,1.92773,1.55859Z" style="fill: #fff"/><path d="M56.44728,8.44092h.88086v2.48145h.07031a1.3856,1.3856,0,0,1,1.373-.80664,1.48339,1.48339,0,0,1,1.55078,1.67871v2.90723h-.88965v-2.688c0-.71924-.335-1.0835-.96289-1.0835a1.05194,1.05194,0,0,0-1.13379,1.1416v2.62988h-.88867Z" style="fill: #fff"/><path d="M61.43946,13.42822c0-.81055.60352-1.27783,1.6748-1.34424l1.21973-.07031V11.625c0-.47559-.31445-.74414-.92188-.74414-.49609,0-.83984.18213-.93848.50049h-.86035c.09082-.77344.81836-1.26953,1.83984-1.26953,1.12891,0,1.76514.562,1.76514,1.51318v3.07666h-.855v-.63281H64.293a1.515,1.515,0,0,1-1.35254.707A1.36026,1.36026,0,0,1,61.43946,13.42822Zm2.89453-.38477V12.667l-1.09961.07031c-.62012.0415-.90137.25244-.90137.64941,0,.40527.35156.64111.835.64111A1.0615,1.0615,0,0,0,64.334,13.04346Z" style="fill: #fff"/><path d="M66.60987,10.19873h.85547v.69043h.06641a1.22092,1.22092,0,0,1,1.21582-.76514,1.86836,1.86836,0,0,1,.39648.03711v.877a2.43442,2.43442,0,0,0-.49609-.05371A1.05507,1.05507,0,0,0,67.49855,12.043v2.65869h-.88867Z" style="fill: #fff"/><path d="M69.96144,15.15234h.90918c.0752.32666.45117.5376,1.05078.5376.74023,0,1.17871-.35156,1.17871-.94678v-.86426H73.0337a1.51433,1.51433,0,0,1-1.38965.75635c-1.14941,0-1.86035-.88867-1.86035-2.23682,0-1.373.71875-2.27441,1.86914-2.27441a1.56045,1.56045,0,0,1,1.41406.79395h.07031v-.71924h.85156v4.54c0,1.02979-.80664,1.68311-2.08008,1.68311C70.7837,16.42188,70.05616,15.91748,69.96144,15.15234Zm3.15527-2.7583c0-.897-.46387-1.47168-1.2207-1.47168-.76465,0-1.19434.57471-1.19434,1.47168,0,.89746.42969,1.47217,1.19434,1.47217C72.65773,13.86621,73.11671,13.2959,73.11671,12.394Z" style="fill: #fff"/><path d="M79.21241,13.48584a1.828,1.828,0,0,1-1.95117,1.30273,2.04531,2.04531,0,0,1-2.08008-2.32422,2.07685,2.07685,0,0,1,2.07617-2.35254c1.25293,0,2.00879.856,2.00879,2.27v.31006H76.08644v.0498a1.1902,1.1902,0,0,0,1.19922,1.29,1.07934,1.07934,0,0,0,1.07129-.5459Zm-3.126-1.45117h2.27441a1.08647,1.08647,0,0,0-1.1084-1.1665A1.15162,1.15162,0,0,0,76.08644,12.03467Z" style="fill: #fff"/><path d="M80.45948,10.19873H81.315v.69043h.06641a1.22092,1.22092,0,0,1,1.21582-.76514,1.86836,1.86836,0,0,1,.39648.03711v.877a2.43442,2.43442,0,0,0-.49609-.05371A1.05507,1.05507,0,0,0,81.34815,12.043v2.65869h-.88867Z" style="fill: #fff"/><path d="M86.19581,12.44824c0-1.42285.73145-2.32422,1.86914-2.32422a1.484,1.484,0,0,1,1.38086.79h.06641V8.44092h.88867v6.26074h-.85156v-.71143H89.479a1.56284,1.56284,0,0,1-1.41406.78564C86.91944,14.77588,86.19581,13.87451,86.19581,12.44824Zm.918,0c0,.95508.4502,1.52979,1.20313,1.52979.749,0,1.21191-.583,1.21191-1.52588,0-.93848-.46777-1.52979-1.21191-1.52979C87.56886,10.92236,87.11378,11.501,87.11378,12.44824Z" style="fill: #fff"/><path d="M91.60206,13.42822c0-.81055.60352-1.27783,1.6748-1.34424l1.21973-.07031V11.625c0-.47559-.31445-.74414-.92187-.74414-.49609,0-.83984.18213-.93848.50049h-.86035c.09082-.77344.81836-1.26953,1.83984-1.26953,1.12891,0,1.76563.562,1.76563,1.51318v3.07666h-.85547v-.63281h-.07031a1.515,1.515,0,0,1-1.35254.707A1.36026,1.36026,0,0,1,91.60206,13.42822Zm2.89453-.38477V12.667L93.397,12.7373c-.62012.0415-.90137.25244-.90137.64941,0,.40527.35156.64111.835.64111A1.0615,1.0615,0,0,0,94.49659,13.04346Z" style="fill: #fff"/><path d="M96.773,10.19873h.85547v.71533h.06641a1.348,1.348,0,0,1,1.34375-.80225,1.46456,1.46456,0,0,1,1.55859,1.6748v2.915h-.88867V12.00977c0-.72363-.31445-1.0835-.97168-1.0835a1.03294,1.03294,0,0,0-1.0752,1.14111v2.63428H96.773Z" style="fill: #fff"/><path d="M103.61769,10.11182c1.0127,0,1.6748.47119,1.76172,1.26514h-.85254c-.082-.33057-.40527-.5415-.90918-.5415-.49609,0-.873.23535-.873.58691,0,.269.22754.43848.71582.55029l.748.17334c.85645.19873,1.25781.56689,1.25781,1.22852,0,.84766-.79,1.41406-1.86523,1.41406-1.07129,0-1.76953-.48389-1.84863-1.28174h.88965a.91365.91365,0,0,0,.97949.562c.55371,0,.94727-.248.94727-.60791,0-.26855-.21094-.44238-.66211-.5498l-.78516-.18213c-.85645-.20264-1.25293-.58691-1.25293-1.25684C101.86866,10.67383,102.60011,10.11182,103.61769,10.11182Z" style="fill: #fff"/></g></g></g><g><path d="M35.19825,18.06689h1.85938V30.48535H35.19825Z" style="fill: #fff"/><path d="M39.29786,22.61084l1.01563-4.54395h1.80664l-1.23047,4.54395Z" style="fill: #fff"/><path d="M49.14649,27.12891H44.4131l-1.13672,3.35645H41.27149l4.4834-12.41846h2.083l4.4834,12.41846H50.28224Zm-4.24316-1.54883h3.752l-1.84961-5.44775h-.05176Z" style="fill: #fff"/><path d="M62.00294,25.959c0,2.81348-1.50586,4.62109-3.77832,4.62109a3.0693,3.0693,0,0,1-2.84863-1.584h-.043v4.48438h-1.8584V21.43115h1.79883V22.937h.03418a3.21162,3.21162,0,0,1,2.88281-1.60059C60.48829,21.33643,62.00294,23.15283,62.00294,25.959Zm-1.91016,0c0-1.8335-.94727-3.03857-2.39258-3.03857-1.41992,0-2.375,1.23047-2.375,3.03857,0,1.82422.95508,3.0459,2.375,3.0459C59.14552,29.00488,60.09278,27.80859,60.09278,25.959Z" style="fill: #fff"/><path d="M71.9673,25.959c0,2.81348-1.50586,4.62109-3.77832,4.62109a3.0693,3.0693,0,0,1-2.84863-1.584h-.043v4.48438H63.43946V21.43115H65.2378V22.937H65.272a3.21162,3.21162,0,0,1,2.88281-1.60059C70.45265,21.33643,71.9673,23.15283,71.9673,25.959Zm-1.91016,0c0-1.8335-.94727-3.03857-2.39258-3.03857-1.41992,0-2.375,1.23047-2.375,3.03857,0,1.82422.95508,3.0459,2.375,3.0459C69.10987,29.00488,70.05714,27.80859,70.05714,25.959Z" style="fill: #fff"/><path d="M78.55323,27.02539c.1377,1.23145,1.334,2.04,2.96875,2.04,1.56641,0,2.69336-.80859,2.69336-1.91895,0-.96387-.67969-1.541-2.28906-1.93652l-1.60937-.38818C78.03663,24.271,76.978,23.20459,76.978,21.47412c0-2.14258,1.86719-3.61426,4.51855-3.61426,2.624,0,4.42285,1.47168,4.4834,3.61426H84.104c-.1123-1.23926-1.13672-1.9873-2.63379-1.9873s-2.52148.75684-2.52148,1.8584c0,.87793.6543,1.39453,2.25488,1.79l1.36816.33594c2.54785.60254,3.60645,1.62646,3.60645,3.44287,0,2.32324-1.85059,3.77832-4.79395,3.77832-2.75391,0-4.61328-1.4209-4.7334-3.667Z" style="fill: #fff"/><path d="M90.19,19.28857v2.14258h1.72168v1.47168H90.19v4.9917c0,.77539.34473,1.13672,1.10156,1.13672a5.80752,5.80752,0,0,0,.61133-.043v1.46289a5.10351,5.10351,0,0,1-1.03223.08594c-1.833,0-2.54785-.68848-2.54785-2.44434V22.90283H87.00636V21.43115h1.31641V19.28857Z" style="fill: #fff"/><path d="M92.90773,25.959c0-2.84912,1.67773-4.63916,4.29395-4.63916,2.625,0,4.29492,1.79,4.29492,4.63916,0,2.85645-1.66113,4.63867-4.29492,4.63867C94.56886,30.59766,92.90773,28.81543,92.90773,25.959Zm6.69531,0c0-1.95459-.89551-3.10791-2.40137-3.10791s-2.40039,1.16211-2.40039,3.10791c0,1.96191.89453,3.10645,2.40039,3.10645S99.603,27.9209,99.603,25.959Z" style="fill: #fff"/><path d="M103.02882,21.43115h1.77246v1.541h.043a2.1594,2.1594,0,0,1,2.17773-1.63574,2.86616,2.86616,0,0,1,.63672.06934V23.144a2.59794,2.59794,0,0,0-.835-.1123,1.8728,1.8728,0,0,0-1.93652,2.0835v5.37012h-1.8584Z" style="fill: #fff"/><path d="M116.22608,27.82617c-.25,1.64355-1.85059,2.77148-3.89844,2.77148-2.63379,0-4.26855-1.76465-4.26855-4.5957,0-2.84033,1.64355-4.68213,4.19043-4.68213,2.50488,0,4.08008,1.7207,4.08008,4.46631v.63672h-6.39453v.1123a2.358,2.358,0,0,0,2.43555,2.56445,2.04834,2.04834,0,0,0,2.09082-1.27344ZM109.94386,25.124h4.52637a2.17744,2.17744,0,0,0-2.2207-2.29834A2.29214,2.29214,0,0,0,109.94386,25.124Z" style="fill: #fff"/></g></g></svg></a><a class="frak-badge" data-frak-install href="{INSTALL_URL}" aria-label="Disponible sur Google Play"><img src="data:image/png;base64,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" alt="" width="646" height="192"></a></div></div><div class="frak-center"><svg width="118" height="118" viewBox="-4 -4 37 37" shape-rendering="crispEdges" role="img" aria-label="QR code de téléchargement"><rect x="-4" y="-4" width="37" height="37" fill="#fff"/><path fill="#14171c" d="M0 0h7v1h-7zM10 0h1v1h-1zM12 0h4v1h-4zM17 0h3v1h-3zM22 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM9 1h1v1h-1zM12 1h6v1h-6zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h4v1h-4zM13 2h1v1h-1zM15 2h1v1h-1zM20 2h1v1h-1zM22 2h1v1h-1zM24 2h3v1h-3zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h1v1h-1zM12 3h1v1h-1zM14 3h2v1h-2zM17 3h1v1h-1zM22 3h1v1h-1zM24 3h3v1h-3zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h1v1h-1zM10 4h1v1h-1zM15 4h6v1h-6zM22 4h1v1h-1zM24 4h3v1h-3zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM10 5h3v1h-3zM18 5h1v1h-1zM20 5h1v1h-1zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h7v1h-7zM8 7h2v1h-2zM11 7h2v1h-2zM14 7h1v1h-1zM16 7h1v1h-1zM0 8h1v1h-1zM2 8h5v1h-5zM10 8h1v1h-1zM16 8h2v1h-2zM19 8h1v1h-1zM22 8h5v1h-5zM1 9h3v1h-3zM5 9h1v1h-1zM7 9h1v1h-1zM9 9h1v1h-1zM11 9h1v1h-1zM13 9h3v1h-3zM17 9h8v1h-8zM28 9h1v1h-1zM2 10h6v1h-6zM9 10h1v1h-1zM13 10h5v1h-5zM24 10h1v1h-1zM5 11h1v1h-1zM8 11h2v1h-2zM13 11h1v1h-1zM15 11h1v1h-1zM18 11h3v1h-3zM23 11h1v1h-1zM25 11h1v1h-1zM27 11h1v1h-1zM1 12h1v1h-1zM4 12h1v1h-1zM6 12h2v1h-2zM10 12h1v1h-1zM12 12h1v1h-1zM14 12h2v1h-2zM17 12h1v1h-1zM19 12h1v1h-1zM25 12h2v1h-2zM0 13h1v1h-1zM2 13h1v1h-1zM7 13h3v1h-3zM12 13h1v1h-1zM15 13h2v1h-2zM19 13h1v1h-1zM22 13h3v1h-3zM28 13h1v1h-1zM3 14h4v1h-4zM8 14h1v1h-1zM10 14h1v1h-1zM12 14h1v1h-1zM17 14h2v1h-2zM20 14h1v1h-1zM24 14h3v1h-3zM0 15h2v1h-2zM3 15h1v1h-1zM10 15h2v1h-2zM14 15h1v1h-1zM16 15h1v1h-1zM19 15h1v1h-1zM21 15h1v1h-1zM23 15h1v1h-1zM27 15h1v1h-1zM2 16h6v1h-6zM9 16h4v1h-4zM16 16h2v1h-2zM19 16h1v1h-1zM21 16h1v1h-1zM25 16h2v1h-2zM0 17h1v1h-1zM3 17h2v1h-2zM8 17h1v1h-1zM12 17h4v1h-4zM19 17h6v1h-6zM26 17h1v1h-1zM28 17h1v1h-1zM0 18h1v1h-1zM2 18h1v1h-1zM4 18h3v1h-3zM9 18h2v1h-2zM13 18h4v1h-4zM20 18h1v1h-1zM22 18h3v1h-3zM26 18h1v1h-1zM0 19h1v1h-1zM3 19h2v1h-2zM8 19h2v1h-2zM12 19h2v1h-2zM15 19h1v1h-1zM18 19h1v1h-1zM21 19h2v1h-2zM24 19h1v1h-1zM27 19h1v1h-1zM0 20h1v1h-1zM2 20h2v1h-2zM5 20h2v1h-2zM9 20h4v1h-4zM14 20h2v1h-2zM17 20h1v1h-1zM20 20h5v1h-5zM26 20h3v1h-3zM8 21h1v1h-1zM10 21h1v1h-1zM15 21h2v1h-2zM18 21h1v1h-1zM20 21h1v1h-1zM24 21h5v1h-5zM0 22h7v1h-7zM9 22h1v1h-1zM18 22h3v1h-3zM22 22h1v1h-1zM24 22h3v1h-3zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h2v1h-2zM14 23h1v1h-1zM16 23h1v1h-1zM19 23h2v1h-2zM24 23h1v1h-1zM27 23h2v1h-2zM0 24h1v1h-1zM2 24h3v1h-3zM6 24h1v1h-1zM8 24h1v1h-1zM17 24h1v1h-1zM20 24h5v1h-5zM26 24h1v1h-1zM28 24h1v1h-1zM0 25h1v1h-1zM2 25h3v1h-3zM6 25h1v1h-1zM8 25h2v1h-2zM11 25h1v1h-1zM13 25h3v1h-3zM17 25h2v1h-2zM20 25h1v1h-1zM25 25h2v1h-2zM0 26h1v1h-1zM2 26h3v1h-3zM6 26h1v1h-1zM8 26h1v1h-1zM10 26h1v1h-1zM12 26h2v1h-2zM15 26h1v1h-1zM21 26h7v1h-7zM0 27h1v1h-1zM6 27h1v1h-1zM9 27h2v1h-2zM12 27h5v1h-5zM18 27h3v1h-3zM23 27h1v1h-1zM25 27h1v1h-1zM27 27h1v1h-1zM0 28h7v1h-7zM8 28h2v1h-2zM11 28h1v1h-1zM17 28h1v1h-1zM19 28h1v1h-1zM21 28h6v1h-6z"/></svg><p class="frak-muted frak-small">Scannez pour installer</p></div></section><section><h2>Questions fréquentes</h2><details open><summary>C\'est vraiment gratuit ?</summary><p>Oui, totalement. Pas d\'abonnement, pas de frais cachés. Vos gains arrivent dans votre porte-monnaie et vous pouvez les transférer vers votre compte bancaire, sans commission.</p></details><details><summary>Quand est-ce que je reçois mon argent ?</summary><p>À chaque commande générée par votre lien, vos gains sont crédités automatiquement dans votre porte-monnaie Frak. Ils deviennent transférables une fois l\'achat confirmé par la marque, sans montant minimum.</p></details><details><summary>Mes amis paient-ils plus cher avec mon lien ?</summary><p>Non, au contraire. En commandant via votre lien ils reçoivent eux aussi un cashback sur leur achat.</p></details><details><summary>Il faut être influenceur ?</summary><p>Non. Le programme est ouvert à tous nos clients, quelle que soit la taille de votre réseau.</p></details><details><summary>C\'est quoi Frak ?</summary><p>Le partenaire qui gère le suivi des parrainages et le versement des gains pour {BRAND}. <a class="frak-link" href="{FRAK_URL}" target="_blank" rel="noopener">Frak</a> ne vend aucune donnée à des tiers.</p></details><p class="frak-center"><a class="frak-cta" data-frak-shop href="{SHOP_URL}">Découvrir la boutique {BRAND}</a></p><p class="frak-muted frak-small frak-center">Programme propulsé par <a class="frak-link" href="{FRAK_URL}" target="_blank" rel="noopener"><strong>Frak</strong></a></p></section></div>';
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
    const FRAK_URL = "https://frak.id";

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
            .replaceAll("{SHOP_URL}", `${location.origin}/`)
            .replaceAll("{FRAK_URL}", FRAK_URL);
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
            image: (u) => set("image", `url("${u}")`),
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
            ". __frakAmb.image(url) pour l’image de marque, .cloneClasses() pour tenter les classes du thème, .remove() pour restaurer."
        );
    };

    return mount();
})();
