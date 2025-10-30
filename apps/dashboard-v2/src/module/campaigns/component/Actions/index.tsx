import { Button } from "@frak-labs/ui/component/Button";
import { useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { memo, useCallback, useEffect } from "react";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { campaignStore } from "@/stores/campaignStore";
import styles from "./index.module.css";

export const Actions = memo(function Actions({
    isLoading = false,
}: {
    isLoading?: boolean;
}) {
    const navigate = useNavigate();
    const step = campaignStore((state) => state.step);
    const setStep = campaignStore((state) => state.setStep);
    const campaignSuccess = campaignStore((state) => state.success);
    const campaignAction = campaignStore((state) => state.action);
    const setIsClosing = campaignStore((state) => state.setIsClosing);
    const campaignId = campaignStore((state) => state.campaign.id);

    const getPages = useCallback(
        (campaignId?: string) => {
            if (campaignAction === "create") {
                return [
                    "/campaigns/new",
                    "/campaigns/metrics",
                    "/campaigns/validation",
                ];
            }
            if (campaignAction === "draft") {
                return [
                    `/campaigns/draft/${campaignId}`,
                    `/campaigns/draft/${campaignId}/metrics`,
                    `/campaigns/draft/${campaignId}/validation`,
                ];
            }
        },
        [campaignAction]
    );

    const pages = getPages(campaignId);

    useEffect(() => {
        if (!pages) return;
        navigate({ to: pages[step - 1] });
    }, [step, navigate, pages]);

    return (
        <ActionsWrapper
            left={
                <Button
                    type={"submit"}
                    variant={"outline"}
                    onClick={() => setIsClosing(true)}
                >
                    Close
                </Button>
            }
            right={
                <>
                    {step > 1 && !campaignSuccess && (
                        <Button
                            variant={"informationOutline"}
                            onClick={() => setStep((prev) => prev - 1)}
                        >
                            Previous
                        </Button>
                    )}
                    {!campaignSuccess && (
                        <ButtonNext
                            isLoading={isLoading}
                            isLastStep={step === pages?.length}
                        />
                    )}
                </>
            }
        />
    );
});

function ButtonNext({
    isLoading = false,
    isLastStep = false,
}: {
    isLoading: boolean;
    isLastStep: boolean;
}) {
    const setIsClosing = campaignStore((state) => state.setIsClosing);
    return isLastStep ? (
        <Button
            type={"submit"}
            variant={"submit"}
            isLoading={isLoading}
            disabled={isLoading}
        >
            Publish
        </Button>
    ) : (
        <Button
            type={"submit"}
            variant={"information"}
            onClick={() => setIsClosing(false)}
        >
            Next
        </Button>
    );
}

export function ActionsMessageSuccess() {
    return (
        <span
            className={`${styles.action__message} ${styles["action__message--success"]}`}
        >
            <Check />
            All changes have been saved
        </span>
    );
}

export function ActionsMessageError({ error }: { error?: Error }) {
    return (
        <span
            className={`${styles.action__message} ${styles["action__message--error"]}`}
        >
            <X />
            {error?.message ?? "An error occurred"}
        </span>
    );
}
