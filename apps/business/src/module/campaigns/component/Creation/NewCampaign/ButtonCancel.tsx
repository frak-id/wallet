import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import { CloseIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/module/common/component/ConfirmDialog";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { campaignStore } from "@/stores/campaignStore";

/**
 * Round glass "X" in the wizard header. Opens a "Close draft without saving it?"
 * confirmation before resetting the draft and leaving the wizard.
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
        <ConfirmDialog
            trigger={
                <GlassButton
                    as="button"
                    disabled={disabled}
                    aria-label={t("campaigns.create.cancel.dismiss")}
                    icon={<CloseIcon width={22} height={22} />}
                />
            }
            title={t("campaigns.create.cancel.title")}
            description={t("campaigns.create.cancel.description")}
            cancelLabel={t("campaigns.create.cancel.dismiss")}
            confirmLabel={t("campaigns.create.cancel.confirm")}
            confirmTone="primary"
            onConfirm={() => {
                reset();
                onClick();
                navigate({
                    to: "/m/$merchantId/campaigns/list",
                    params: { merchantId },
                });
            }}
        />
    );
}
