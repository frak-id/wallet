import { Button } from "@frak-labs/ui/component/Button";
import { create } from "zustand";
import { Grid } from "@/module/common/component/Grid";
import styles from "./membrs-fanclub.module.css";

const useStepStore = create<{
    step: "step1" | "step2";
    setStep: (step: "step1" | "step2") => void;
}>()((set) => ({
    step: "step2",
    setStep: (step) => set({ step }),
}));

export default function MembrsFanclub() {
    // Get the current step
    const currentStep = useStepStore((state) => state.step);

    return (
        <Grid>
            {currentStep === "step1" && <Step1 />}
            {currentStep === "step2" && <Step2 />}
        </Grid>
    );
}

function Step1() {
    // Set the current step
    const setCurrentStep = useStepStore((state) => state.setStep);

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
