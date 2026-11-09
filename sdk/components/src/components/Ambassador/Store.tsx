import type { Language } from "@frak-labs/core-sdk";
import {
    store,
    storeBadge,
    storeBadgeArt,
    storeBadges,
    storeBody,
    storeLede,
    storeQr,
    storeQrCaption,
    storeTitle,
} from "./Ambassador.css";
import { InstallQr } from "./InstallQr";
import { AppStoreBadgeArt, PlayStoreBadgeArt } from "./storeBadges";

type StoreSectionProps = {
    lang: Language;
    installUrl: string | undefined;
    heading: string;
    lede: string;
    appBadgeAriaLabel: string;
    playBadgeAriaLabel: string;
    qrLabel: string;
    qrCaption: string;
};

export function StoreSection({
    lang,
    installUrl,
    heading,
    lede,
    appBadgeAriaLabel,
    playBadgeAriaLabel,
    qrLabel,
    qrCaption,
}: StoreSectionProps) {
    // An anchor without href has no link role: keep it focusable and announced until the link lands.
    const inert = installUrl === undefined;
    return (
        <section class={`${store} frak-ambassador__store`}>
            <div class={`${storeBody} frak-ambassador__store-body`}>
                <h2 class={`${storeTitle} frak-ambassador__store-title`}>
                    {heading}
                </h2>
                <p class={`${storeLede} frak-ambassador__store-lede`}>{lede}</p>
                <div class={`${storeBadges} frak-ambassador__store-badges`}>
                    <a
                        class={`${storeBadge} frak-ambassador__store-badge frak-ambassador__store-badge--app`}
                        aria-label={appBadgeAriaLabel}
                        href={installUrl}
                        role={inert ? "link" : undefined}
                        tabIndex={inert ? 0 : undefined}
                        aria-disabled={inert ? "true" : undefined}
                    >
                        <AppStoreBadgeArt
                            lang={lang}
                            class={`${storeBadgeArt} frak-ambassador__store-badge-art`}
                        />
                    </a>
                    <a
                        class={`${storeBadge} frak-ambassador__store-badge frak-ambassador__store-badge--play`}
                        aria-label={playBadgeAriaLabel}
                        href={installUrl}
                        role={inert ? "link" : undefined}
                        tabIndex={inert ? 0 : undefined}
                        aria-disabled={inert ? "true" : undefined}
                    >
                        <PlayStoreBadgeArt
                            lang={lang}
                            class={`${storeBadgeArt} frak-ambassador__store-badge-art`}
                        />
                    </a>
                </div>
            </div>
            <InstallQr
                url={installUrl}
                label={qrLabel}
                caption={qrCaption}
                class={`${storeQr} frak-ambassador__store-qr`}
                captionClass={`${storeQrCaption} frak-ambassador__store-qr-caption`}
            />
        </section>
    );
}
