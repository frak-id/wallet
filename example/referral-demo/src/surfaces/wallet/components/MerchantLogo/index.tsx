import type { RecipeVariants } from "@vanilla-extract/recipes";
import { MaisonLuneLogo } from "@/art";
import * as styles from "./merchantLogo.css";

type MerchantLogoSize = NonNullable<
    RecipeVariants<typeof styles.merchantLogo>
>["size"];

/** The merchant's monogram in the wallet's logo slot (history rows, headers). */
export function MerchantLogo({ size }: { size?: MerchantLogoSize }) {
    return (
        <span className={styles.merchantLogo({ size })}>
            <MaisonLuneLogo variant="monogram" />
        </span>
    );
}
