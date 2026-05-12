import { useTranslation } from "react-i18next";
import { HeroContent } from "../HeroContent";
import * as styles from "./index.css";

export type OnboardingHeroProps = {
    /** Translation key suffix: "one" | "two" | "three" */
    translationKey: string;
    /** Image source */
    image: string;
    /** Image layout variant */
    imageVariant?: "cover" | "center";
    /** Optional max-width for the image (e.g. "223px") */
    imageMaxWidth?: string;
    /** Hint that this step owns the LCP — enables fetchpriority=high. */
    priority?: boolean;
};

export function OnboardingHero({
    translationKey,
    image,
    imageVariant = "center",
    imageMaxWidth,
    priority = false,
}: OnboardingHeroProps) {
    const { t } = useTranslation();

    return (
        <HeroContent
            image={
                <img
                    src={image}
                    alt=""
                    decoding="async"
                    fetchPriority={priority ? "high" : "auto"}
                    loading={priority ? "eager" : "lazy"}
                    className={
                        imageVariant === "cover"
                            ? styles.heroImage
                            : styles.heroImageCenter
                    }
                    style={
                        imageMaxWidth ? { maxWidth: imageMaxWidth } : undefined
                    }
                />
            }
            imageVariant={imageVariant}
            title={t(`onboarding.steps.${translationKey}.title`)}
            description={t(`onboarding.steps.${translationKey}.description`)}
        />
    );
}
