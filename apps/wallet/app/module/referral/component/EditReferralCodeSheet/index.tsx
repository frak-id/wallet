import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { referralKey } from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { GlassCloseButton } from "@/module/common/component/GlassCloseButton";
import { Title } from "@/module/common/component/Title";
import { EditReferralCancelModal } from "../EditReferralCancelModal";
import { ReferralCodeForm } from "../ReferralCodeForm";
import * as styles from "./index.css";

type Props = {
    onClose: () => void;
    onSaved: () => void;
};

export function EditReferralCodeSheet({ onClose, onSaved }: Props) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [cancelOpen, setCancelOpen] = useState(false);

    const handleIssued = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: referralKey.status(),
        });
        onSaved();
        onClose();
    }, [queryClient, onSaved, onClose]);

    const requestClose = () => setCancelOpen(true);

    const handleConfirmCancel = () => {
        setCancelOpen(false);
        onClose();
    };

    return (
        <Box className={styles.sheet}>
            <Box className={styles.header}>
                <GlassCloseButton onClick={requestClose} />
                <Box
                    as="button"
                    type="button"
                    className={styles.cancelButton}
                    onClick={requestClose}
                >
                    <Text variant="bodySmall" weight="medium" color="action">
                        {t("wallet.referral.edit.cancel")}
                    </Text>
                </Box>
            </Box>

            <Stack space="m">
                <Title size="page">{t("wallet.referral.edit.title")}</Title>

                <Stack space="xs">
                    <Text as="span" variant="heading4" weight="semiBold">
                        {t("wallet.referral.edit.attentionTitle")}
                    </Text>
                    <Text variant="body" color="secondary">
                        {t("wallet.referral.edit.attentionBody")}
                    </Text>
                </Stack>

                <ReferralCodeForm
                    mode="edit"
                    showAutoGenerate={false}
                    onIssued={handleIssued}
                />
            </Stack>

            <EditReferralCancelModal
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                onConfirm={handleConfirmCancel}
            />
        </Box>
    );
}
