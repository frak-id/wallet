import {
    campaignStepAtom,
    campaignSuccessAtom,
} from "@/module/campaigns/atoms/steps";
import { Button } from "@/module/common/component/Button";
import { Panel } from "@/module/common/component/Panel";
import { useAtom, useSetAtom } from "jotai";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./index.module.css";

const pages = ["/campaigns/new", "/campaigns/metrics", "/campaigns/validation"];

export function Actions() {
    const router = useRouter();
    const [step, setStep] = useAtom(campaignStepAtom);
    const setSuccess = useSetAtom(campaignSuccessAtom);
    const success = step > pages.length;

    useEffect(() => {
        if (success) {
            setSuccess(true);
            return;
        }
        router.push(pages[step - 1]);
    }, [step, router.push, success, setSuccess]);

    return (
        <Panel variant={"secondary"} className={styles.actions}>
            <div className={styles.action__left}>
                <Button
                    variant={"outline"}
                    onClick={() => router.push("/campaigns")}
                >
                    Close
                </Button>
                {success && (
                    <span
                        className={`${styles.action__message} ${styles["action__message--success"]}`}
                    >
                        <Check />
                        All changes have been saved
                    </span>
                )}
            </div>
            <div className={styles.action__right}>
                {step > 1 && step < pages.length && (
                    <Button
                        variant={"informationOutline"}
                        onClick={() => setStep((prev) => prev - 1)}
                    >
                        Previous
                    </Button>
                )}
                <ButtonNext step={step} />
            </div>
        </Panel>
    );
}

function ButtonNext({ step }: { step: number }) {
    if (step > pages.length) return null;
    return step === pages.length ? (
        <Button type={"submit"} variant={"submit"}>
            Publish
        </Button>
    ) : (
        <Button type={"submit"} variant={"information"}>
            Next
        </Button>
    );
}
