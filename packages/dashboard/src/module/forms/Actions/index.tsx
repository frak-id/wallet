import {
    campaignIsClosingAtom,
    campaignStepAtom,
    campaignSuccessAtom,
} from "@/module/campaigns/atoms/steps";
import { Panel } from "@/module/common/component/Panel";
import { Button } from "@module/component/Button";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./index.module.css";

const pages = ["/campaigns/new", "/campaigns/metrics", "/campaigns/validation"];

export function Actions({ isLoading = false }: { isLoading?: boolean }) {
    const router = useRouter();
    const [step, setStep] = useAtom(campaignStepAtom);
    const campaignSuccess = useAtomValue(campaignSuccessAtom);
    const setCampaignIsClosing = useSetAtom(campaignIsClosingAtom);

    useEffect(() => {
        router.push(pages[step - 1]);
    }, [step, router.push]);

    return (
        <Panel variant={"secondary"} className={styles.actions}>
            <div className={styles.action__left}>
                <Button
                    type={"submit"}
                    variant={"outline"}
                    onClick={async () => setCampaignIsClosing(true)}
                >
                    Close
                </Button>
            </div>
            <div className={styles.action__right}>
                {step > 1 && !campaignSuccess && (
                    <Button
                        variant={"informationOutline"}
                        onClick={() => setStep((prev) => prev - 1)}
                    >
                        Previous
                    </Button>
                )}
                {!campaignSuccess && (
                    <ButtonNext step={step} isLoading={isLoading} />
                )}
            </div>
        </Panel>
    );
}

function ButtonNext({
    step,
    isLoading = false,
}: { step: number; isLoading: boolean }) {
    const setCampaignIsClosing = useSetAtom(campaignIsClosingAtom);
    return step === pages.length ? (
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
