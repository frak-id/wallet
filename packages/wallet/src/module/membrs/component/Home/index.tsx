"use client";

import { Membrs } from "@/assets/icons/Membrs";
import { ButtonRippleSmall } from "@/module/common/component/ButtonRippleSmall";
import { Title } from "@/module/common/component/Title";
import { userAtom, userSetupLaterAtom } from "@/module/membrs/atoms/user";
import { useAtomValue, useSetAtom } from "jotai";
import { atom } from "jotai/index";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./index.module.css";

const localStepAtom = atom<"step1" | "step2">("step1");

export function Home() {
    const router = useRouter();

    // Get the user from the atom
    const user = useAtomValue(userAtom);

    // Get the current step
    const currentStep = useAtomValue(localStepAtom);

    // User choose to setup his profile later
    const isUserSetupLater = useAtomValue(userSetupLaterAtom);

    useEffect(() => {
        if (user || isUserSetupLater) return;

        // Redirect to the profile page if the user does not have a profile
        router.push("/membrs/profile");
    }, [user, isUserSetupLater, router.push]);

    return user || isUserSetupLater ? (
        <>
            <div className={styles.home__introduction}>
                <Title className={styles.home__title}>
                    <Membrs />
                </Title>
                <p>Exclusive access to your favorite stars and franchise</p>
            </div>
            <ButtonRippleSmall onClick={() => router.push("/membrs/fanclub")}>
                enter
            </ButtonRippleSmall>
        </>
    ) : null;
}

function Step1() {
    // Set the current step
    const setCurrentStep = useSetAtom(localStepAtom);

    return (
        <>
            <div className={styles.home__introduction}>
                <Title className={styles.home__title}>
                    <Membrs />
                </Title>
                <p>Exclusive access to your favorite stars and franchise</p>
            </div>
            <ButtonRippleSmall onClick={() => setCurrentStep("step2")}>
                enter
            </ButtonRippleSmall>
        </>
    );
}

function Step2() {
    return (
        <>
            <div className={styles.home__step}>
                <p className={styles.home__title}>
                    Join the members club and get access to unique and exclusive
                    experiences with your favorite stars, musicians, sportsmen,
                    brands, franchise, and many more...
                </p>
            </div>
            <ButtonRippleSmall>i’m ready for this</ButtonRippleSmall>
        </>
    );
}
