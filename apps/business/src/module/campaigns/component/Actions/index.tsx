import { Button } from "@frak-labs/ui/component/Button";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { memo, useCallback } from "react";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { campaignStore } from "@/stores/campaignStore";
import styles from "./index.module.css";

function getStepFromPath(pathname: string): number {
    if (pathname.endsWith("/validation")) return 3;
    if (pathname.endsWith("/metrics")) return 2;
    return 1;
}

function getPreviousPath(pathname: string, campaignId?: string): string | null {
    const step = getStepFromPath(pathname);
    if (step === 1) return null;

    const baseId = campaignId ?? "new";
    if (step === 3) return `/campaigns/draft/${baseId}/metrics`;
    if (step === 2) return `/campaigns/draft/${baseId}`;
    return null;
}

export const Actions = memo(function Actions({
    isLoading = false,
}: {
    isLoading?: boolean;
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const isSuccess = campaignStore((state) => state.isSuccess);
    const campaignId = campaignStore((state) => state.draft.id);

    const step = getStepFromPath(location.pathname);
    const previousPath = getPreviousPath(location.pathname, campaignId);

    const handlePrevious = useCallback(() => {
        if (previousPath) {
            // biome-ignore lint/suspicious/noExplicitAny: dynamic route paths
            navigate({ to: previousPath as any });
        }
    }, [navigate, previousPath]);

    return (
        <ActionsWrapper
            left={
                <Button type={"submit"} variant={"outline"}>
                    Save Draft
                </Button>
            }
            right={
                <>
                    {previousPath && !isSuccess && (
                        <Button
                            variant={"informationOutline"}
                            onClick={handlePrevious}
                        >
                            Previous
                        </Button>
                    )}
                    {!isSuccess && (
                        <ButtonNext
                            isLoading={isLoading}
                            isLastStep={step === 3}
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
        <Button type={"submit"} variant={"information"}>
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
