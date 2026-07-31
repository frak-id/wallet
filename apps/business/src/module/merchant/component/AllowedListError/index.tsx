import { Text } from "@frak-labs/design-system/components/Text";
import { Trans, useTranslation } from "react-i18next";
import type { AllowedListError as AllowedListErrorType } from "@/module/merchant/hook/allowedListError";
import * as styles from "./allowed-list-error.css";

const SUPPORT_EMAIL = "hello@frak-labs.com";

type ClaimedKey =
    | "merchantEdit.domains.claimed"
    | "merchantEdit.packageIds.claimed";
type FallbackKey =
    | "merchantEdit.domains.addError"
    | "merchantEdit.packageIds.addError";

/**
 * Failure message for an allow-list add. A cross-merchant claim cannot be
 * resolved self-serve — the competing entry sits on a merchant this user
 * cannot see, let alone edit — so that one case points at support instead.
 */
export function AllowedListErrorMessage({
    error,
    claimedCode,
    claimedKey,
    fallbackKey,
}: {
    error: AllowedListErrorType;
    claimedCode: string;
    // Narrowed to the two allow-lists rather than `ParseKeys`: the full key
    // union is too large for `Trans` to instantiate.
    claimedKey: ClaimedKey;
    fallbackKey: FallbackKey;
}) {
    const { t } = useTranslation();

    return (
        <Text variant="caption" color="error">
            {error.code === claimedCode ? (
                <Trans
                    i18nKey={claimedKey}
                    components={{
                        support: (
                            // Content is replaced by the translated address;
                            // spelled out here so the anchor is never empty.
                            <a
                                href={`mailto:${SUPPORT_EMAIL}`}
                                className={styles.supportLink}
                            >
                                {SUPPORT_EMAIL}
                            </a>
                        ),
                    }}
                />
            ) : (
                t(fallbackKey)
            )}
        </Text>
    );
}
