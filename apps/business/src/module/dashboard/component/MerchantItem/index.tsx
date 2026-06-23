import { Avatar } from "@frak-labs/design-system/components/Avatar";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { LinkButton } from "@/module/common/component/LinkButton";
import * as styles from "./merchant-item.css";

type MerchantItemProps = {
    merchantId: string;
    name: string;
    domain: string;
    onManageBudget: () => void;
};

export function MerchantItem({
    merchantId,
    name,
    domain,
    onManageBudget,
}: MerchantItemProps) {
    const { t } = useTranslation();

    return (
        <Card className={styles.cell}>
            <div className={styles.avatarWrap}>
                <Avatar name={name} />
            </div>
            <Stack space="xs" className={styles.body}>
                <Stack space="xxs">
                    <Text
                        variant="body"
                        weight="medium"
                        title={name}
                        className={styles.name}
                    >
                        {name}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {domain}
                    </Text>
                </Stack>
                <Inline space="xs">
                    <Button
                        variant="primary"
                        size="small"
                        width="auto"
                        onClick={onManageBudget}
                    >
                        {t("dashboard.actions.manageBudget")}
                    </Button>
                    <LinkButton
                        to="/m/$merchantId/merchant/customize"
                        params={{ merchantId }}
                        variant="secondary"
                        size="small"
                    >
                        {t("dashboard.actions.edit")}
                    </LinkButton>
                </Inline>
            </Stack>
        </Card>
    );
}
