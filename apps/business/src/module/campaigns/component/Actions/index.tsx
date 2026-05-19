import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { memo, useCallback, useEffect } from "react";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Button } from "@/module/common/component/Button";
import { campaignStore } from "@/stores/campaignStore";

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
    onSaveDraft,
    isSaving = false,
    isSaved = false,
}: {
    isLoading?: boolean;
    onSaveDraft?: () => void;
    isSaving?: boolean;
    isSaved?: boolean;
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const isSuccess = campaignStore((state) => state.isSuccess);
    const setSuccess = campaignStore((state) => state.setSuccess);
    const campaignId = campaignStore((state) => state.draft.id);

    const step = getStepFromPath(location.pathname);
    const previousPath = getPreviousPath(location.pathname, campaignId);

    useEffect(() => {
        if (!isSuccess || step === 3) return;
        setSuccess(false);
    }, [isSuccess, setSuccess, step]);

    const handlePrevious = useCallback(() => {
        if (previousPath) {
            // biome-ignore lint/suspicious/noExplicitAny: dynamic route paths
            navigate({ to: previousPath as any });
        }
    }, [navigate, previousPath]);

    if (isSuccess) return null;

    return (
        <ActionsWrapper
            left={
                <>
                    <Button
                        type={"button"}
                        variant={"secondary"}
                        onClick={onSaveDraft}
                        disabled={isLoading || isSaving}
                        loading={isSaving}
                    >
                        Save Draft
                    </Button>
                    {isSaved && <ActionsMessageSuccess />}
                </>
            }
            right={
                <>
                    {previousPath && !isSuccess && (
                        <Button variant={"secondary"} onClick={handlePrevious}>
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
            variant={"primary"}
            loading={isLoading}
            disabled={isLoading}
        >
            Publish
        </Button>
    ) : (
        <Button type={"submit"} variant={"secondary"}>
            Next
        </Button>
    );
}

export function ActionsMessageSuccess() {
    return (
        <Inline space="s" alignY="center">
            <Check />
            <Text as="span" color="success" weight="semiBold">
                All changes have been saved
            </Text>
        </Inline>
    );
}

export function ActionsMessageError({ error }: { error?: Error }) {
    return (
        <Inline space="s" alignY="center">
            <X />
            <Text as="span" color="error" weight="semiBold">
                {error?.message ?? "An error occurred"}
            </Text>
        </Inline>
    );
}
