import type { SlideProps } from "./Slide";
import slideImgThree from "./SlideThree.webp";
import slideImgOne from "./slideOne.webp";
import slideImgTwo from "./slideTwo.webp";

export { Slide } from "./Slide";

export const onboardingSlides: readonly SlideProps[] = [
    { translationKey: "one", image: slideImgOne, imageVariant: "cover" },
    { translationKey: "two", image: slideImgTwo, imageMaxWidth: "320px" },
    { translationKey: "three", image: slideImgThree, imageMaxWidth: "223px" },
];
