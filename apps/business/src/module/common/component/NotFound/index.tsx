import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { SearchIcon } from "@frak-labs/design-system/icons";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { badgeIcon, card, container } from "./not-found.css";

export function NotFound() {
    const { t } = useTranslation();
    return (
        <div className={container}>
            <Card variant="elevated" radius="m" padding="none" className={card}>
                <Stack space="m" align="center">
                    <IconCircle size="md">
                        <SearchIcon className={badgeIcon} />
                    </IconCircle>
                    <Text as="h1" variant="heading1" weight="bold">
                        {t("errors.notFound.title")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("errors.notFound.description")}
                    </Text>
                    <Link to="/dashboard">
                        <Button variant="primary" width="auto">
                            {t("errors.notFound.action")}
                        </Button>
                    </Link>
                </Stack>
            </Card>
        </div>
    );
}
