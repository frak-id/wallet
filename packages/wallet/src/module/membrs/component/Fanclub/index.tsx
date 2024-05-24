"use client";

import { ButtonColored } from "@/module/common/component/ButtonColored";
import { ButtonRippleSmall } from "@/module/common/component/ButtonRippleSmall";
import { atom, useAtomValue, useSetAtom } from "jotai/index";
import Image from "next/image";
// import digital from "./icons/digital.png";
import sport from "./icons/sport.png";
import styles from "./index.module.css";

const localStepAtom = atom<"step1" | "step2">("step2");

export function FanClub() {
    // Get the current step
    const currentStep = useAtomValue(localStepAtom);

    return (
        <>
            {currentStep === "step1" && <Step1 />}
            {currentStep === "step2" && <Step2 />}
        </>
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
            <ButtonRippleSmall onClick={() => setCurrentStep("step2")}>
                i’m ready for this
            </ButtonRippleSmall>
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
                    <ButtonColored>
                        <span className={styles.fanClub__buttonText}>
                            <Image src={sport} alt={""} />
                            <span>Sportsmen/women</span>
                        </span>
                    </ButtonColored>
                </li>
                <li>
                    <ButtonColored>Streaming/Cinema</ButtonColored>
                </li>
            </ul>
            <ButtonRippleSmall>next</ButtonRippleSmall>
        </>
    );
}
