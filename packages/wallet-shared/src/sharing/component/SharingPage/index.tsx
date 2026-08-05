import { Text } from "@frak-labs/design-system/components/Text";
import { clsx } from "clsx";
import { useRef } from "react";
import { ExternalLink } from "../../../common/component/ExternalLink";
import { PostShareConfirmation } from "../PostShareConfirmation";
import { containerChromeless, overlay, overlayChromeless } from "../shared.css";
import { useOverlayBehaviour } from "../useOverlayBehaviour";
import { Faq } from "./Faq";
import { Footer } from "./Footer";
import { PageHeader } from "./PageHeader";
import { ProductList } from "./ProductCard";
import { RewardCard } from "./RewardCard";
import { Steps } from "./Steps";
import * as styles from "./sharingPage.css";
import { isChromeless, type SharingPageProps } from "./types";

export { getStep2Context } from "./Steps";
export type {
    SharingActions,
    SharingChrome,
    SharingMerchant,
    SharingPageProps,
    SharingProducts,
    SharingReward,
    SharingShareState,
    SharingT,
} from "./types";

/**
 * The sharing page, in both of its screens.
 *
 * Presentation only: every decision — which link, which reward, whether an
 * outcome is handed to a host — is made by `useSharingPageController` and
 * arrives here already resolved.
 */
export function SharingPage({
    merchant,
    view,
    chrome,
    sharingLink,
    installUrl,
    reward,
    products,
    share,
    actions,
    t,
}: SharingPageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chromeless = isChromeless(chrome);

    // A host that owns the sheet owns dismissal too: an in-page Escape or
    // backdrop click it cannot observe would empty the sheet while the host
    // keeps it open. Also off on the confirmation screen, which renders its
    // own overlay with its own dismiss — two live handlers on `document` would
    // fire two different callbacks for one Escape.
    useOverlayBehaviour({
        enabled: !chromeless && view === "share",
        onDismiss: actions.onDismiss,
        containerRef,
    });

    if (view === "confirmation") {
        return (
            <PostShareConfirmation
                installUrl={installUrl}
                merchant={merchant}
                t={t}
                chrome={chrome}
                onDismiss={actions.onConfirmationDismiss}
                onShareAgain={actions.onShareAgain}
                onInstall={actions.onInstall}
            />
        );
    }

    const backdropDismiss = chromeless ? undefined : actions.onDismiss;

    return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: dismissal has a keyboard equivalent in `useOverlayBehaviour`'s document-level Escape listener, not a per-element handler — the backdrop is never focusable.
        <div
            className={clsx(overlay, chromeless && overlayChromeless)}
            onClick={backdropDismiss}
        >
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick only stops the backdrop's dismiss-on-click from firing; same rationale as the backdrop above. */}
            <div
                ref={containerRef}
                className={clsx(
                    styles.container,
                    chromeless && containerChromeless
                )}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                {!chromeless && (
                    <PageHeader
                        merchant={merchant}
                        t={t}
                        onDismiss={actions.onDismiss}
                    />
                )}

                <main className={styles.main}>
                    <RewardCard merchant={merchant} reward={reward} t={t} />

                    <section className={styles.rewardCard}>
                        <Text as="h2" variant="heading2">
                            {t("sdk.sharingPage.reward.title")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("sdk.sharingPage.reward.tagline")}
                        </Text>
                    </section>

                    {products && products.items.length > 0 && (
                        <ProductList products={products} />
                    )}

                    <Steps reward={reward} t={t} />

                    <Faq reward={reward} t={t} />

                    <nav className={styles.legalLinks}>
                        <ExternalLink
                            href="https://frak.id/support"
                            className={styles.legalLink}
                        >
                            {t("sdk.sharingPage.legal.help")}
                        </ExternalLink>
                        <ExternalLink
                            href="https://frak.id/privacy"
                            className={styles.legalLink}
                        >
                            {t("sdk.sharingPage.legal.privacy")}
                        </ExternalLink>
                        <ExternalLink
                            href="https://frak.id/terms"
                            className={styles.legalLink}
                        >
                            {t("sdk.sharingPage.legal.terms")}
                        </ExternalLink>
                    </nav>
                </main>

                <Footer
                    share={share}
                    sharingLink={sharingLink}
                    actions={actions}
                    t={t}
                />
            </div>
        </div>
    );
}
