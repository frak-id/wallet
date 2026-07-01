import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./CopyableSnippet.module.css";

/**
 * A read-only code block with a copy-to-clipboard button. The embedded admin
 * iframe often blocks clipboard-write, so on failure we surface a "select it
 * manually" hint instead of failing silently — the <pre> stays selectable.
 *
 * i18n labels default to the shared `appearance.manual.*` keys but can be
 * overridden per usage.
 */
export function CopyableSnippet({
    snippet,
    copyLabelKey = "appearance.manual.copyTag",
    copiedLabelKey = "appearance.manual.copied",
    errorLabelKey = "appearance.manual.copyError",
}: {
    snippet: string;
    copyLabelKey?: string;
    copiedLabelKey?: string;
    errorLabelKey?: string;
}) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState(false);

    function copy() {
        if (!navigator.clipboard?.writeText) {
            setError(true);
            return;
        }
        navigator.clipboard.writeText(snippet).then(
            () => {
                setError(false);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            },
            () => setError(true)
        );
    }

    return (
        <div className={styles.wrapper}>
            <pre className={styles.snippet}>{snippet}</pre>
            <div className={styles.copyButton}>
                <s-button variant="primary" onClick={copy}>
                    {copied ? t(copiedLabelKey) : t(copyLabelKey)}
                </s-button>
            </div>
            {error && <s-text color="subdued">{t(errorLabelKey)}</s-text>}
        </div>
    );
}

/** Shared inline-code class for `<code>` inside Trans hints. */
export const inlineCodeClass = styles.inlineCode;
