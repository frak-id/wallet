import type { MerchantInfo } from "@frak-labs/wallet-shared";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import * as styles from "./index.css";

type MerchantLogoSize = NonNullable<
    RecipeVariants<typeof styles.merchantLogo>
>["size"];

export function MerchantLogo({
    merchant,
    size = "small",
}: {
    merchant: MerchantInfo;
    size?: MerchantLogoSize;
}) {
    return (
        <div className={styles.merchantLogo({ size })}>
            {merchant.logoUrl ? (
                <img
                    src={merchant.logoUrl}
                    alt={merchant.name}
                    className={styles.merchantLogoImg}
                />
            ) : (
                <span className={styles.merchantLogoFallback({ size })}>
                    {merchant.name.charAt(0).toUpperCase()}.
                </span>
            )}
        </div>
    );
}
