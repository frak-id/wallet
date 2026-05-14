import type { ReactNode } from "react";
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
    /** Optional wrapper around the <img>; identity by default. */
    imageWrapper?: (image: ReactNode) => ReactNode;
};

export function OnboardingHero({
    translationKey,
    image,
    imageVariant = "center",
    imageMaxWidth,
    imageWrapper,
    priority = false,
}: OnboardingHeroProps) {
    const { t } = useTranslation();

    const img = (
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
            style={imageMaxWidth ? { maxWidth: imageMaxWidth } : undefined}
        />
    );

    return (
        <HeroContent
            image={imageWrapper ? imageWrapper(img) : img}
            imageVariant={imageVariant}
            title={t(`onboarding.steps.${translationKey}.title`)}
            description={t(`onboarding.steps.${translationKey}.description`)}
        />
    );
}
