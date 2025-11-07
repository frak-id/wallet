import { ButtonWithConfirmationAlert } from "@/module/common/component/ButtonWithConfirmationAlert";
import { campaignStore } from "@/stores/campaignStore";

export function ButtonCancel({
    onClick,
    disabled,
}: {
    onClick: () => void;
    disabled?: boolean;
}) {
    const reset = campaignStore((state) => state.reset);

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
                window.location.href = "/campaigns/list";
            }}
            disabled={disabled}
        />
    );
}
