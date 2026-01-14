import { cx } from "class-variance-authority";
import {
    type CSSProperties,
    type PropsWithChildren,
    useEffect,
    useState,
} from "react";
import { Trans } from "react-i18next";
import { Arrow } from "@/module/embedded/component/Onboarding/assets/Arrow";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";
import styles from "./index.module.css";

function Onboarding({
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

function OnboardingArrow({ style }: { style?: CSSProperties }) {
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
    const { lang, i18n } = useListenerTranslation();
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        // Hide the onboarding after 2.5 seconds
        const timer = setTimeout(() => setHidden(true), 2_500);
        return () => clearTimeout(timer);
    }, []);

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
                    tOptions={{ lng: lang }}
                    i18n={i18n}
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

export function OnboardingShare({ isHidden = true }: { isHidden?: boolean }) {
    const { lang, i18n } = useListenerTranslation();
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
                    tOptions={{ lng: lang }}
                    i18n={i18n}
                />
            </Onboarding>
            <OnboardingArrow style={{ top: "-53px", left: "60px" }} />
        </div>
    );
}
