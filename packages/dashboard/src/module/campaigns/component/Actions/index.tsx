import {
    campaignActionAtom,
    campaignAtom,
} from "@/module/campaigns/atoms/campaign";
import {
    campaignIsClosingAtom,
    campaignStepAtom,
    campaignSuccessAtom,
} from "@/module/campaigns/atoms/steps";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Button } from "@module/component/Button";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect } from "react";
import styles from "./index.module.css";

export const Actions = memo(function Actions({
    isLoading = false,
}: { isLoading?: boolean }) {
    const router = useRouter();
    const [step, setStep] = useAtom(campaignStepAtom);
    const campaignSuccess = useAtomValue(campaignSuccessAtom);
    const campaignAction = useAtomValue(campaignActionAtom);
    const setCampaignIsClosing = useSetAtom(campaignIsClosingAtom);
    const { id: campaignId } = useAtomValue(campaignAtom);

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
        router.push(pages[step - 1]);
    }, [step, router.push, pages]);

    return (
        <ActionsWrapper
            left={
                <Button
                    type={"submit"}
                    variant={"outline"}
                    onClick={() => setCampaignIsClosing(true)}
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
}: { isLoading: boolean; isLastStep: boolean }) {
    const setCampaignIsClosing = useSetAtom(campaignIsClosingAtom);
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
            onClick={() => setCampaignIsClosing(false)}
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

export function ActionsMessageError({ error }: { error: Error }) {
    return (
        <span
            className={`${styles.action__message} ${styles["action__message--error"]}`}
        >
            <X />
            {error.message}
        </span>
    );
}
