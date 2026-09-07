import { NumberedCircle } from "@frak-labs/design-system/components/NumberedCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "./sharingPage.css";
import type { SharingReward, SharingT } from "./types";

/**
 * Step 2's i18next context key. Contexts don't compose, so the four combinations
 * are enumerated as distinct keys.
 */
export function getStep2Context(
    isProductScoped: boolean,
    minPurchaseAmount: string | undefined
): "min" | "product" | "min_product" | undefined {
    if (isProductScoped) {
        return minPurchaseAmount ? "min_product" : "product";
    }
    return minPurchaseAmount ? "min" : undefined;
}

/**
 * The three-step "how it works" list. Each step is two keys, `title` and
 * `description`; i18next contexts fall back to the base key, so only the variants
 * that actually differ are translated.
 */
export function Steps({ reward, t }: { reward: SharingReward; t: SharingT }) {
    const ready = reward.status === "ready" ? reward : undefined;
    const minPurchaseAmount = ready?.minPurchaseAmount;
    const step2Context = getStep2Context(
        ready?.isProductScoped === true,
        minPurchaseAmount
    );
    const step2 = step2Context
        ? { context: step2Context, minAmount: minPurchaseAmount }
        : undefined;

    // appended to step 3 rather than replacing its description
    const lockupNote =
        ready?.lockupDurationDays != null
            ? t("sdk.sharingPage.steps.3.lockup", {
                  lockupInDay: ready.lockupDurationDays,
              })
            : undefined;

    return (
        <Stack as="section" space="m">
            <ol className={styles.stepper}>
                <Step
                    number={1}
                    connector="dark"
                    title={t("sdk.sharingPage.steps.1.title")}
                    descriptions={[t("sdk.sharingPage.steps.1.description")]}
                />
                <Step
                    number={2}
                    connector="default"
                    title={t("sdk.sharingPage.steps.2.title", step2)}
                    descriptions={[
                        t("sdk.sharingPage.steps.2.description", step2),
                    ]}
                />
                <Step
                    number={3}
                    title={t("sdk.sharingPage.steps.3.title")}
                    descriptions={[
                        t("sdk.sharingPage.steps.3.description"),
                        lockupNote,
                    ]}
                />
            </ol>
        </Stack>
    );
}

/** One numbered step: a title plus description lines, falsy lines skipped. */
function Step({
    number,
    connector,
    title,
    descriptions,
}: {
    number: number;
    connector?: "default" | "dark";
    title: string;
    descriptions: (string | undefined)[];
}) {
    return (
        <li className={styles.stepItem}>
            <NumberedCircle number={number} color="filled" />
            {connector === "dark" && (
                <span className={styles.stepConnectorDark} />
            )}
            {connector === "default" && (
                <span className={styles.stepConnector} />
            )}
            <Stack space="xxs">
                <Text variant="bodySmall" weight="semiBold">
                    {title}
                </Text>
                {descriptions
                    .filter((line): line is string => Boolean(line))
                    .map((line) => (
                        <Text
                            key={line}
                            variant="bodySmall"
                            className={styles.stepDescription}
                        >
                            {line}
                        </Text>
                    ))}
            </Stack>
        </li>
    );
}
