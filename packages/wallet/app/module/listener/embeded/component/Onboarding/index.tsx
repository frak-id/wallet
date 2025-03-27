import { Arrow } from "@/module/listener/embeded/component/Onboarding/assets/Arrow";
import { useEmbededListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import { cx } from "class-variance-authority";
import {
    type CSSProperties,
    type PropsWithChildren,
    useEffect,
    useRef,
    useState,
} from "react";
import { Trans } from "react-i18next";
import styles from "./index.module.css";

export function Onboarding({
    style,
    isReverse,
    children,
}: PropsWithChildren<{
    style?: CSSProperties;
    isReverse?: boolean;
}>) {
    return (
        <div
            className={cx(
                styles.onboarding,
                isReverse && styles["onboarding--reverse"]
            )}
            style={{
                top: style?.top ?? "auto",
                left: style?.left ?? "auto",
                right: style?.right ?? "auto",
            }}
        >
            {children}
        </div>
    );
}

export function OnboardingArrow({ style }: { style?: CSSProperties }) {
    return (
        <Arrow
            className={styles.onboarding__arrow}
            style={{
                top: style?.top ?? "auto",
                left: style?.left ?? "auto",
                right: style?.right ?? "auto",
                transform: style?.transform,
            }}
        />
    );
}

export function OnboardingWelcome() {
    const { translation } = useEmbededListenerUI();
    const { data: currentSession } = useInteractionSessionStatus();
    const [hidden, setHidden] = useState(false);
    const calledOnce = useRef(false);

    useEffect(() => {
        // Hide the onboarding after 2.5 seconds
        setTimeout(() => setHidden(true), 2_500);
    }, []);

    useEffect(() => {
        if (calledOnce.current) return;
        // Hide the onboarding if the session is active
        const isSessionActive = !!currentSession;
        setHidden(isSessionActive);
        if (isSessionActive) {
            calledOnce.current = true;
        }
    }, [currentSession]);

    return (
        <div
            className={cx(
                styles.onboardingWrapper,
                hidden && styles["onboardingWrapper--hidden"]
            )}
        >
            <Onboarding style={{ top: "92px", right: "-39px" }}>
                <Trans
                    i18nKey={"sdk.wallet.loggedIn.onboarding.welcome"}
                    tOptions={{ lng: translation.lang }}
                />
            </Onboarding>
            <OnboardingArrow
                style={{
                    top: "45px",
                    right: "-51px",
                    transform: "scaleY(-1) rotate(33deg)",
                }}
            />
        </div>
    );
}

export function OnboardingActivate({
    isReverse,
    isHidden = true,
}: { isReverse?: boolean; isHidden?: boolean }) {
    const { translation } = useEmbededListenerUI();
    const DELAY_MS = 1_500;

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const showOnboardingTimer = setTimeout(() => {
            setIsVisible(true);
        }, DELAY_MS);

        // Cleanup timer on component unmount
        return () => clearTimeout(showOnboardingTimer);
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        setIsVisible(!isHidden);
    }, [isHidden, isVisible]);

    return (
        <div
            className={cx(
                styles.onboardingWrapper,
                !isVisible && styles["onboardingWrapper--hidden"]
            )}
        >
            <Onboarding
                style={{ top: "-68px", left: "0px" }}
                isReverse={isReverse}
            >
                <Trans
                    i18nKey={"sdk.wallet.loggedIn.onboarding.activate"}
                    tOptions={{ lng: translation.lang }}
                />
            </Onboarding>
            <OnboardingArrow
                style={{
                    top: "-34px",
                    left: "-33px",
                    transform: "scaleY(-1) rotate(185deg)",
                }}
            />
        </div>
    );
}

export function OnboardingShare({ isHidden = true }: { isHidden?: boolean }) {
    const { translation } = useEmbededListenerUI();
    const [hidden, setHidden] = useState(isHidden);

    useEffect(() => {
        setHidden(isHidden);
    }, [isHidden]);

    return (
        <div
            className={cx(
                styles.onboardingWrapper,
                hidden && styles["onboardingWrapper--hidden"]
            )}
        >
            <Onboarding style={{ top: "-90px", right: "10px" }}>
                <Trans
                    i18nKey={"sdk.wallet.loggedIn.onboarding.share"}
                    tOptions={{ lng: translation.lang }}
                />
            </Onboarding>
            <OnboardingArrow style={{ top: "-53px", left: "60px" }} />
        </div>
    );
}
