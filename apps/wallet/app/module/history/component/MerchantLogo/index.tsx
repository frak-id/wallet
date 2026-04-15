import type { MerchantInfo } from "@frak-labs/wallet-shared";
import * as styles from "./index.css";

type MerchantLogoSize = keyof typeof styles.merchantLogo;

export function MerchantLogo({
    merchant,
    size = "small",
}: {
    merchant: MerchantInfo;
    size?: MerchantLogoSize;
}) {
    return (
        <div className={styles.merchantLogo[size]}>
            {merchant.logoUrl ? (
                <img
                    src={merchant.logoUrl}
                    alt={merchant.name}
                    className={styles.merchantLogoImg}
                />
            ) : (
                <span className={styles.merchantLogoFallback[size]}>
                    {merchant.name.charAt(0).toUpperCase()}.
                </span>
            )}
        </div>
    );
}
