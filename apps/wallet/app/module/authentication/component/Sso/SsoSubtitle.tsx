import { ExternalLink } from "@frak-labs/wallet-shared";
import { Trans } from "react-i18next";
import * as styles from "@/module/authentication/component/Sso/index.css";
import type { Metadata } from "@/module/authentication/component/Sso/types";

/**
 * Hero subtitle — "to immediately receive your winnings from {merchant}".
 * Returns null when the metadata has no merchant name.
 */
export function SsoSubtitle({ metadata }: { metadata: Metadata }) {
    if (!metadata.name) return null;
    return (
        <Trans
            i18nKey={"authent.sso.subTitle"}
            values={{
                productName: metadata.name,
                productLink: metadata.homepageLink,
            }}
            components={{
                pLink: metadata.homepageLink ? (
                    <ExternalLink
                        href={metadata.homepageLink}
                        className={styles.merchantLink}
                    >
                        {metadata.name}
                    </ExternalLink>
                ) : (
                    <u>{metadata.name}</u>
                ),
            }}
        />
    );
}
