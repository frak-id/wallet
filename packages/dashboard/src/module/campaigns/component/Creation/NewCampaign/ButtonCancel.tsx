import { campaignResetAtom } from "@/module/campaigns/atoms/campaign";
import { CancelButtonWithAlert } from "@/module/common/component/CancelButtonWithAlert";
import { useSetAtom } from "jotai";

export function ButtonCancel({
    onClick,
    disabled,
}: { onClick: () => void; disabled?: boolean }) {
    const campaignReset = useSetAtom(campaignResetAtom);

    return (
        <CancelButtonWithAlert
            description={
                <>
                    Are you sure you want to cancel the campaign ?<br />
                    Form will be reset to its initial state.
                </>
            }
            buttonText={"Cancel campaign"}
            title={"Cancel campaign"}
            onClick={() => {
                campaignReset();
                onClick();
                window.location.href = "/campaigns/list";
            }}
            disabled={disabled}
        />
    );
}
