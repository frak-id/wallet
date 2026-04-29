import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { SparklesIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { OrDivider } from "../OrDivider";
import { ReferralCodeForm } from "../ReferralCodeForm";
import { TermsDisclosure } from "../TermsDisclosure";
import * as styles from "./index.css";

export function CreateReferralCodePage() {
    const { t } = useTranslation();

    return (
        <Stack space="m" className={styles.page}>
            <Stack space="m">
                <Back href="/profile/referral" />
                <Title size="page">{t("wallet.referral.create.title")}</Title>
            </Stack>
            <Text variant="body" color="secondary">
                {t("wallet.referral.create.description")}
            </Text>
            <ReferralCodeForm />
            <OrDivider />
            <Button
                type="button"
                variant="secondary"
                size="small"
                width="full"
                onClick={() => {
                    // TODO: auto-generate a 4-letter code
                }}
            >
                {t("wallet.referral.create.autoGenerate")}
                <SparklesIcon />
            </Button>
            <Box className={styles.disclosure}>
                <TermsDisclosure />
            </Box>
        </Stack>
    );
}
