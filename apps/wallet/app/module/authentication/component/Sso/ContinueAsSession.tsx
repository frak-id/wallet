import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowLeftIcon, WalletIcon } from "@frak-labs/design-system/icons";
import { ua } from "@frak-labs/wallet-shared";
import { Trans, useTranslation } from "react-i18next";
import type { Address } from "viem";
import { shortenAddress } from "@/module/common/utils/shortenAddress";

/**
 * Smooth path shown when an active session is already in `sessionStore`.
 *
 * Renders three stacked elements:
 *  1. A single primary CTA ("Continue with my wallet") that forwards the
 *     existing session to the listener iframe via `sso_complete`. No
 *     biometry, no re-pair.
 *  2. A caption telling the user which merchant + which wallet address
 *     the click will sign them in to.
 *  3. A ghost "Use another account" link that flips the parent state to
 *     reveal the standard login/register choices without touching the
 *     session in store — so cancelling preserves the paired desktop.
 */
export function ContinueAsSession({
    address,
    productName,
    onContinue,
    loading,
    onUseAnother,
}: {
    address: Address;
    productName?: string;
    onContinue: () => void;
    loading?: boolean;
    onUseAnother: () => void;
}) {
    const { t } = useTranslation();
    return (
        <>
            <Box>
                <Button
                    variant="primary"
                    icon={<WalletIcon width={24} height={24} />}
                    onClick={onContinue}
                    loading={loading}
                >
                    {t("authent.sso.btn.continue")}
                </Button>
            </Box>
            <Text variant="caption" align="center" color="primary">
                <Trans
                    i18nKey="authent.sso.continueDescription"
                    values={{
                        productName: productName ?? "",
                        address: shortenAddress(address),
                    }}
                />
            </Text>
            <Box>
                <Button variant="ghost" onClick={onUseAnother}>
                    {t("authent.sso.btn.useAnother")}
                </Button>
            </Box>
        </>
    );
}

export function PhonePairingAction({ onClick }: { onClick: () => void }) {
    const { t } = useTranslation();

    // Don't show the phone pairing action on mobile devices
    if (ua.isMobile) {
        return null;
    }

    return (
        <Box>
            <Button variant="ghost" onClick={onClick}>
                {t("authent.sso.btn.new.phone")}
            </Button>
        </Box>
    );
}

/**
 * Ghost "← Back to my wallet" button shown when the user has bypassed the
 * session shortcut (via "Use another account") but might want to return to
 * it. Restores the smooth flow without touching the session in store.
 */
export function BackToSessionAction({ onClick }: { onClick: () => void }) {
    const { t } = useTranslation();
    return (
        <Box>
            <Button
                variant="ghost"
                icon={<ArrowLeftIcon width={16} height={16} />}
                onClick={onClick}
            >
                {t("authent.sso.btn.backToSession")}
            </Button>
        </Box>
    );
}
