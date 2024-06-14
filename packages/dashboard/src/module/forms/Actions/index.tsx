import {
    campaignStepAtom,
    campaignSuccessAtom,
} from "@/module/campaigns/atoms/steps";
import { Button } from "@/module/common/component/Button";
import { Panel } from "@/module/common/component/Panel";
import { useAtom, useAtomValue } from "jotai";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./index.module.css";

const LAST_STEP = 3;
const pages = ["/campaigns/new", "/campaigns/metrics", "/campaigns/validation"];

export function Actions() {
    const router = useRouter();
    const [step, setStep] = useAtom(campaignStepAtom);
    const success = useAtomValue(campaignSuccessAtom);

    useEffect(() => {
        if (success) return;
        router.push(pages[step - 1]);
    }, [step, router.push, success]);

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
                {step > 1 && (
                    <Button
                        variant={"informationOutline"}
                        onClick={() => setStep((prev) => prev - 1)}
                    >
                        Previous
                    </Button>
                )}
                {step === LAST_STEP ? (
                    <Button type={"submit"} variant={"submit"}>
                        Publish
                    </Button>
                ) : (
                    <Button type={"submit"} variant={"information"}>
                        Next
                    </Button>
                )}
            </div>
        </Panel>
    );
}
