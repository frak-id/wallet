import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { trackEvent } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";

type EmailNotFoundModalProps = {
    onClose: () => void;
    /**
     * Email the user typed on `/login/email` for which the backend
     * reported no active wallet binding. Forwarded to `/register` so
     * the onboarding flow can pre-fill the email step.
     */
    email: string;
};

/**
 * Bottom-sheet/dialog surfaced when the user types an email on
 * `/login/email` that `POST /auth/emailStatus` reports as `used: false`
 * (or `used: true` with an empty `authenticatorIds[]`, which happens
 * when the resolved wallet has no active binding on the current chain).
 *
 * Two outs:
 *  - "Create an account" → `/register?new=1&email=…`. `new=1` bypasses
 *    the local-passkeys redirect guard in `register.tsx:beforeLoad`,
 *    `email` pre-fills the email step.
 *  - "Use a different email" → close the modal and let the user retry
 *    on the same `/login/email` page.
 */
export function EmailNotFoundModal({
    onClose,
    email,
}: EmailNotFoundModalProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const title = t("wallet.login.email.notFound.title");
    const description = t("wallet.login.email.notFound.description", { email });
    const closeLabel = t("common.close");

    const handleCreate = useCallback(() => {
        trackEvent("auth_login_method_selected", {
            method: "register_redirect",
        });
        onClose();
        navigate({
            to: "/register",
            search: { new: true, email },
            replace: true,
        });
    }, [email, navigate, onClose]);

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={title}
            description={description}
            header={
                <CloseButton
                    ariaLabel={closeLabel}
                    iconSize={24}
                    variant="inline"
                    onClick={onClose}
                />
            }
        >
            <Stack space="l">
                <Stack space="s">
                    <Text variant="heading2" weight="semiBold">
                        {title}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {description}
                    </Text>
                </Stack>
                <Box display="flex" flexDirection="column" gap="s">
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={handleCreate}
                    >
                        {t("wallet.login.email.notFound.create")}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        onClick={onClose}
                    >
                        {t("wallet.login.email.notFound.useDifferent")}
                    </Button>
                </Box>
            </Stack>
        </ResponsiveModal>
    );
}
