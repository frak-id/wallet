import type { MerchantInfo } from "@frak-labs/wallet-shared";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import * as styles from "./index.css";

type MerchantLogoSize = NonNullable<
    RecipeVariants<typeof styles.merchantLogo>
>["size"];

// Matches the `size` variant's pixel dimensions in `index.css.ts` — passed
// as explicit `width`/`height` so the browser reserves space before the
// image loads (avoids layout shift once lazy-loading is enabled below).
const MERCHANT_LOGO_PX = {
    small: 40,
    large: 64,
} as const satisfies Record<NonNullable<MerchantLogoSize>, number>;

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
                    width={MERCHANT_LOGO_PX[size]}
                    height={MERCHANT_LOGO_PX[size]}
                    loading="lazy"
                    decoding="async"
                />
            ) : (
                <span className={styles.merchantLogoFallback({ size })}>
                    {merchant.name.charAt(0).toUpperCase()}.
                </span>
            )}
        </div>
    );
}
