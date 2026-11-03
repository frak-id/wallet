import { useMerchantT } from "../format";
import { AppleLogo } from "../icons";
import * as styles from "./applePayButton.css";

/** The " Pay" lockup, drawn: the logo glyph is not in non-Apple fonts. */
export function ApplePayMark({ size = 18 }: { size?: number }) {
    return (
        <span className={styles.mark}>
            <AppleLogo size={size} className={styles.logo} />
            Pay
        </span>
    );
}

/** Black Apple Pay button: "Acheter avec  Pay", "Payer avec  Pay", or the bare mark. */
export function ApplePayButton({
    label,
    size,
    className,
    onClick,
}: {
    label?: "buy" | "pay";
    size?: "regular" | "compact";
    className?: string;
    onClick: () => void;
}) {
    const t = useMerchantT();
    return (
        <button
            type="button"
            className={[styles.button({ size }), className]
                .filter(Boolean)
                .join(" ")}
            onClick={onClick}
        >
            {label && (
                <span className={styles.label}>
                    {t(label === "buy" ? "applePay.buy" : "applePay.pay")}
                </span>
            )}
            <ApplePayMark />
        </button>
    );
}
