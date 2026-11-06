import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useT } from "@/i18n";
import stepOne from "../../assets/stepOne.webp";
import stepThree from "../../assets/stepThree.webp";
import stepTwo from "../../assets/stepTwo.webp";
import { walletMessages } from "../../messages";
import * as styles from "./onboardingHero.css";

export type OnboardingStepId = "one" | "two" | "three";

/** Image, layout and 1x display width of each onboarding step, as the app ships them. */
const heroes: Record<
    OnboardingStepId,
    { image: string; layout: "cover" | "tall"; maxWidth?: number }
> = {
    one: { image: stepOne, layout: "cover" },
    two: { image: stepTwo, layout: "tall", maxWidth: 344 },
    three: { image: stepThree, layout: "tall", maxWidth: 238 },
};

export function OnboardingHero({ step }: { step: OnboardingStepId }) {
    const t = useT(walletMessages);
    const { image, layout, maxWidth } = heroes[step];
    return (
        <div className={styles.hero}>
            <div className={styles.imageArea({ layout })}>
                <img
                    src={image}
                    alt=""
                    decoding="async"
                    className={styles.image({ layout })}
                    style={maxWidth ? { maxWidth } : undefined}
                />
            </div>
            <Stack space="m">
                <Text as="h2" variant="heading1" className={styles.title}>
                    {t(`onboarding.${step}.title`)}
                </Text>
                <p className={styles.description}>
                    {t(`onboarding.${step}.description`)}
                </p>
            </Stack>
        </div>
    );
}
