import type { SlideProps } from "./Slide";
import slideImgThree from "./SlideThree.png";
import slideImgOne from "./slideOne.jpg";
import slideImgTwo from "./slideTwo.png";

export { Slide } from "./Slide";

export const onboardingSlides: readonly SlideProps[] = [
    { translationKey: "one", image: slideImgOne, imageVariant: "cover" },
    { translationKey: "two", image: slideImgTwo },
    { translationKey: "three", image: slideImgThree },
];
