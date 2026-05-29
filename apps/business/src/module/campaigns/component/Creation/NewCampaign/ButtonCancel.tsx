import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon, ExclamationIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@/module/common/component/Button";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { campaignStore } from "@/stores/campaignStore";
import * as styles from "./buttonCancel.css";

/**
 * Round glass "X" in the wizard header. Opens a confirmation matching the Figma
 * "Close draft without saving it?" screen (Dashboard 338:54688) before resetting
 * the draft and leaving the wizard.
 */
export function ButtonCancel({
    onClick,
    disabled,
}: {
    onClick: () => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const reset = campaignStore((state) => state.reset);
    const merchantId = useActiveMerchantId();

    return (
        <AlertDialog
            showCloseButton={false}
            classNameContent={styles.content}
            classNameTitle={styles.title}
            buttonElement={
                <GlassButton
                    as="button"
                    disabled={disabled}
                    aria-label={t("campaigns.create.cancel.dismiss")}
                    icon={<CloseIcon width={22} height={22} />}
                />
            }
            title={
                <Stack space="m" align="center">
                    <IconCircle size="md">
                        <ExclamationIcon className={styles.badgeIcon} />
                    </IconCircle>
                    <Text as="span" variant="heading2">
                        {t("campaigns.create.cancel.title")}
                    </Text>
                </Stack>
            }
            description={
                <Text variant="body" color="secondary" align="center">
                    {t("campaigns.create.cancel.description")}
                </Text>
            }
            footer={{ className: styles.footer }}
            cancel={
                <Button variant="secondary" size="large" width="full">
                    {t("campaigns.create.cancel.dismiss")}
                </Button>
            }
            actionClose
            action={
                <Button
                    variant="primary"
                    size="large"
                    width="full"
                    onClick={() => {
                        reset();
                        onClick();
                        navigate({
                            to: "/m/$merchantId/campaigns/list",
                            params: { merchantId },
                        });
                    }}
                >
                    {t("campaigns.create.cancel.confirm")}
                </Button>
            }
        />
    );
}
