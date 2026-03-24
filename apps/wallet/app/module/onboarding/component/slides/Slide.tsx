import { useTranslation } from "react-i18next";
import { HeroContent } from "../HeroContent";
import * as styles from "./index.css";

export type SlideProps = {
    /** Translation key suffix: "one" | "two" | "three" */
    translationKey: string;
    /** Image source */
    image: string;
    /** Image layout variant */
    imageVariant?: "cover" | "center";
};

export function Slide({
    translationKey,
    image,
    imageVariant = "center",
}: SlideProps) {
    const { t } = useTranslation();

    return (
        <HeroContent
            image={
                <img
                    src={image}
                    alt=""
                    className={
                        imageVariant === "cover" ? styles.slideImg : undefined
                    }
                />
            }
            imageVariant={imageVariant}
            title={t(`onboarding.slides.${translationKey}.title`)}
            description={t(`onboarding.slides.${translationKey}.description`)}
        />
    );
}
