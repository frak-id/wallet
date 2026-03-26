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
    /** Optional max-width for the image (e.g. "223px") */
    imageMaxWidth?: string;
};

export function Slide({
    translationKey,
    image,
    imageVariant = "center",
    imageMaxWidth,
}: SlideProps) {
    const { t } = useTranslation();

    return (
        <HeroContent
            image={
                <img
                    src={image}
                    alt=""
                    className={
                        imageVariant === "cover"
                            ? styles.slideImg
                            : styles.slideImgCenter
                    }
                    style={
                        imageMaxWidth ? { maxWidth: imageMaxWidth } : undefined
                    }
                />
            }
            imageVariant={imageVariant}
            title={t(`onboarding.slides.${translationKey}.title`)}
            description={t(`onboarding.slides.${translationKey}.description`)}
        />
    );
}
