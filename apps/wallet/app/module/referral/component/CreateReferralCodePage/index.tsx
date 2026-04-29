import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { referralKey, useReferralStatus } from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { ReferralCodeForm } from "../ReferralCodeForm";
import { TermsDisclosure } from "../TermsDisclosure";
import * as styles from "./index.css";

export function CreateReferralCodePage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: status } = useReferralStatus();
    const willRedirect = !!status?.ownedCode;

    useEffect(() => {
        if (willRedirect) {
            navigate({ to: "/profile/referral", replace: true });
        }
    }, [willRedirect, navigate]);

    const onIssued = useCallback(
        async (_code: string) => {
            // TODO: navigate to a confirmation screen showing the issued code.
            await queryClient.invalidateQueries({
                queryKey: referralKey.status(),
            });
            navigate({ to: "/profile/referral" });
        },
        [queryClient, navigate]
    );

    if (willRedirect) return null;

    return (
        <Stack space="m" className={styles.page}>
            <Stack space="m">
                <Back href="/profile/referral" />
                <Title size="page">{t("wallet.referral.create.title")}</Title>
            </Stack>
            <Text variant="body" color="secondary">
                {t("wallet.referral.create.description")}
            </Text>
            <ReferralCodeForm onIssued={onIssued} />
            <Box className={styles.disclosure}>
                <TermsDisclosure />
            </Box>
        </Stack>
    );
}
