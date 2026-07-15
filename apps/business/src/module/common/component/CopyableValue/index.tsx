import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, CopyIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { useCopyToClipboardWithState } from "@/module/common/hook/useCopyToClipboardWithState";
import * as styles from "./copyable-value.css";

/**
 * A copy-to-clipboard value pill — the shared affordance used for DNS TXT
 * verification records, TOTP manual-entry keys, and any other "here's a
 * string, copy it" surface. Elevated box with an optional helper line above a
 * monospace value + trailing icon that flips to a check on copy so it reads
 * unmistakably as copyable.
 */
export function CopyableValue({
    value,
    /** Text actually copied to the clipboard — defaults to `value`. */
    copyText,
    label,
    /** Optional instruction rendered inside the box, above the value. */
    helper,
}: {
    value: string;
    copyText?: string;
    label?: string;
    helper?: string;
}) {
    const { t } = useTranslation();
    const { copied, copy } = useCopyToClipboardWithState();

    return (
        <div className={styles.box}>
            {helper && (
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    className={styles.helper}
                >
                    {helper}
                </Text>
            )}
            <div className={styles.row}>
                <Text variant="bodySmall" className={styles.value}>
                    {value}
                </Text>
                <button
                    type="button"
                    className={styles.copyButton}
                    aria-label={label ?? t("common.copy")}
                    onClick={() => copy(copyText ?? value)}
                >
                    {copied ? (
                        <CheckIcon width={16} height={16} />
                    ) : (
                        <CopyIcon width={16} height={16} />
                    )}
                </button>
            </div>
        </div>
    );
}
