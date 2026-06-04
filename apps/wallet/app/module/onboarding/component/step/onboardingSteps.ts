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
    {
        translationKey: "two",
        image: stepImgTwo,
        // 2x asset → 1x display width 688/2 = 344px (matches the Figma cards).
        imageVariant: "centerTall",
        imageMaxWidth: "344px",
    },
    {
        translationKey: "three",
        image: stepImgThree,
        imageVariant: "centerTall",
        // 2x asset → 1x display width 476/2 = 238px (the artwork box reads
        // 223.6px, but the export includes the badge's shadow bleed).
        imageMaxWidth: "238px",
    },
];
