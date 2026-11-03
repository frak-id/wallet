import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CopyIcon,
    LogoFrakWithName,
    ShareIcon,
} from "@frak-labs/design-system/icons";
import { clsx } from "clsx";
import { MaisonLuneLogo, ProductArt } from "@/art";
import { useDemoNav } from "@/core/store";
import { heroProductId, products } from "@/data/merchant";
import { useLang, useT } from "@/i18n";
import type { FrakSharingPageProps } from "@/surfaces/contracts";
import { sharingMessages } from "../messages";
import { Faq } from "./Faq";
import { RewardCard } from "./RewardCard";
import { Steps } from "./Steps";
import * as styles from "./sharingPage.css";

/** The picker with its one product, already selected; drawn rather than Radix-backed. */
function ProductPicker() {
    const t = useT(sharingMessages);
    const lang = useLang();
    return (
        <section className={styles.productList} aria-label={t("productsLabel")}>
            <div className={styles.productCardSelected}>
                <span className={styles.radio} aria-hidden="true">
                    <span className={styles.radioDot} />
                </span>
                <span className={styles.productImage}>
                    <ProductArt productId={heroProductId} variant="packshot" />
                </span>
                <Text as="span" variant="bodySmall" weight="medium">
                    {products[heroProductId].name[lang]}
                </Text>
            </div>
        </section>
    );
}

/** `wallet.frak.id/sharing` as the SDK opens it after a purchase. */
export function FrakSharingPage({ inert = false }: FrakSharingPageProps) {
    const t = useT(sharingMessages);
    const { next } = useDemoNav();

    return (
        <div
            className={clsx(styles.container, inert && styles.inert)}
            aria-hidden={inert || undefined}
        >
            <header className={styles.header}>
                <Box display="flex" alignItems="center" gap="m">
                    <span className={styles.merchantLogo}>
                        <MaisonLuneLogo variant="monogram" />
                    </span>
                    <LogoFrakWithName className={styles.logo} />
                </Box>
                <button type="button" className={styles.dismissButton}>
                    {t("dismiss")}
                </button>
            </header>

            <main className={styles.main}>
                <RewardCard />

                <section className={styles.rewardIntro}>
                    <Text as="h2" variant="heading2">
                        {t("rewardTitle")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("rewardTagline")}
                    </Text>
                </section>

                <ProductPicker />

                <Steps />

                <Faq />

                <nav className={styles.legalLinks}>
                    <span className={styles.legalLink}>{t("legalHelp")}</span>
                    <span className={styles.legalLink}>
                        {t("legalPrivacy")}
                    </span>
                    <span className={styles.legalLink}>{t("legalTerms")}</span>
                </nav>
            </main>

            <footer className={styles.footer}>
                <button
                    type="button"
                    className={styles.shareButton}
                    onClick={inert ? undefined : next}
                >
                    {t("share")}
                    <ShareIcon width={16} height={16} />
                </button>
                <button type="button" className={styles.copyButton}>
                    {t("copy")}
                    <CopyIcon width={16} height={16} />
                </button>
            </footer>
        </div>
    );
}
