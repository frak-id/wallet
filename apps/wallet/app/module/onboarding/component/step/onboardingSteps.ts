import type { OnboardingHeroProps } from "./OnboardingHero";
import stepImgOne from "./stepOne.webp";
import stepImgThree from "./stepThree.webp";
import stepImgTwo from "./stepTwo.webp";

export const onboardingSteps: readonly OnboardingHeroProps[] = [
    {
        translationKey: "one",
        image: stepImgOne,
        imageVariant: "cover",
        priority: true,
    },
    { translationKey: "two", image: stepImgTwo, imageMaxWidth: "320px" },
    { translationKey: "three", image: stepImgThree, imageMaxWidth: "223px" },
];
