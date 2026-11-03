import { NumberedCircle } from "@frak-labs/design-system/components/NumberedCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { campaign } from "@/data/rewards";
import { useT } from "@/i18n";
import { sharingMessages } from "../messages";
import * as styles from "./sharingPage.css";

function Step({
    number,
    connector,
    title,
    descriptions,
}: {
    number: number;
    connector?: "default" | "dark";
    title: string;
    descriptions: string[];
}) {
    return (
        <li className={styles.stepItem}>
            <NumberedCircle
                number={number}
                color="filled"
                className={styles.stepCircle}
            />
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
                {descriptions.map((line) => (
                    <Text key={line} variant="bodySmall" color="tertiary">
                        {line}
                    </Text>
                ))}
            </Stack>
        </li>
    );
}

/** The three-step "how it works" list. */
export function Steps() {
    const t = useT(sharingMessages);
    return (
        <Stack as="section" space="m">
            <ol className={styles.stepper}>
                <Step
                    number={1}
                    connector="dark"
                    title={t("step1Title")}
                    descriptions={[t("step1Description")]}
                />
                <Step
                    number={2}
                    connector="default"
                    title={t("step2Title")}
                    descriptions={[t("step2Description")]}
                />
                <Step
                    number={3}
                    title={t("step3Title")}
                    descriptions={[
                        t("step3Description"),
                        t("step3Lockup", { days: campaign.validationDays }),
                    ]}
                />
            </ol>
        </Stack>
    );
}
