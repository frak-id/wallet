import { useNavigate } from "@tanstack/react-router";
import { ButtonWithConfirmationAlert } from "@/module/common/component/ButtonWithConfirmationAlert";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { campaignStore } from "@/stores/campaignStore";

export function ButtonCancel({
    onClick,
    disabled,
}: {
    onClick: () => void;
    disabled?: boolean;
}) {
    const navigate = useNavigate();
    const reset = campaignStore((state) => state.reset);
    const merchantId = useActiveMerchantId();

    return (
        <ButtonWithConfirmationAlert
            description={
                <>
                    Are you sure you want to cancel the campaign ?<br />
                    Form will be reset to its initial state.
                </>
            }
            buttonText={"Cancel campaign"}
            title={"Cancel campaign"}
            onClick={() => {
                reset();
                onClick();
                navigate({
                    to: "/m/$merchantId/campaigns/list",
                    params: { merchantId },
                });
            }}
            disabled={disabled}
        />
    );
}
