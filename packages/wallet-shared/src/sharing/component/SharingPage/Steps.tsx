import { NumberedCircle } from "@frak-labs/design-system/components/NumberedCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "./sharingPage.css";
import type { SharingReward, SharingT } from "./types";

/**
 * Step 2's i18next context key. Contexts don't compose, so the four
 * combinations are enumerated as distinct keys.
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
 * The three-step "how it works" list.
 *
 * Each step is two keys, `title` and `description`, rather than one string this
 * component splits at its first period. The split rule could not survive copy
 * that has a period anywhere else — a price ("Spend 10.50 € to earn."), an
 * abbreviation, a decimal — and silently produced a title of everything up to
 * that period.
 *
 * i18next contexts append to the last key segment, so `steps.2.title` with
 * `{ context: "product" }` resolves `steps.2.title_product` and falls back to
 * `steps.2.title` when that variant does not exist. That fallback is load
 * bearing: step 2's title is identical for the base and `min` cases, so only
 * the variants that actually differ are translated.
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

    // Extra step 3 line stating when locked earnings become available. Its own
    // key rather than a context variant of the description, so it can be
    // appended to that step instead of replacing it.
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

/**
 * One numbered "how it works" step: a title plus zero or more description
 * lines (falsy lines are skipped, so optional copy can be passed straight
 * through).
 */
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
