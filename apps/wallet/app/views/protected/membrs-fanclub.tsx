import { Grid } from "@/module/common/component/Grid";
import { Button } from "@frak-labs/ui/component/Button";
import { atom, useAtomValue, useSetAtom } from "jotai";
import styles from "./membrs-fanclub.module.css";

const localStepAtom = atom<"step1" | "step2">("step2");

export default function MembrsFanclub() {
    // Get the current step
    const currentStep = useAtomValue(localStepAtom);

    return (
        <Grid>
            {currentStep === "step1" && <Step1 />}
            {currentStep === "step2" && <Step2 />}
        </Grid>
    );
}

function Step1() {
    // Set the current step
    const setCurrentStep = useSetAtom(localStepAtom);

    return (
        <>
            <div className={styles.fanClub__introduction}>
                <p>
                    Join the members club and get access to unique and exclusive
                    experiences with your favorite stars, musicians, sportsmen,
                    brands, franchise, and many more...
                </p>
            </div>
            <Button onClick={() => setCurrentStep("step2")}>
                i’m ready for this
            </Button>
        </>
    );
}

function Step2() {
    return (
        <>
            <div className={styles.fanClub__introduction}>
                <p>
                    Jul, Lena Situation, L’équipe, there is someone or something
                    you’re fond of. Search and pick your one and only
                </p>
            </div>
            <ul className={styles.fanClub__list}>
                <li>
                    <Button>
                        <span className={styles.fanClub__buttonText}>
                            <span>Sportsmen/women</span>
                        </span>
                    </Button>
                </li>
                <li>
                    <Button>Streaming/Cinema</Button>
                </li>
            </ul>
            <Button>next</Button>
        </>
    );
}
