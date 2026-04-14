import type { Currency } from "@frak-labs/core-sdk";
import { parseMarkdown } from "../utils/variables";
import * as styles from "./styles.css";

type ModalPreviewProps = {
    text?: string;
    buttonLabel?: string;
    logoUrl?: string;
    currency: Currency;
};

/**
 * Preview of the SDK login/reward modal
 */
export function ModalPreview({
    text,
    buttonLabel,
    logoUrl,
    currency,
}: ModalPreviewProps) {
    const parsedText = text ? parseMarkdown(text, currency) : null;

    return (
        <div className={styles.modalPreview}>
            <div className={styles.header}>
                {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className={styles.logo} />
                ) : (
                    <span className={styles.headerText}>Logo</span>
                )}
            </div>
            <p className={styles.text}>
                {parsedText && parsedText.length > 0 ? parsedText : text}
            </p>
            <button type="button" className={styles.button}>
                {buttonLabel}
            </button>
        </div>
    );
}
