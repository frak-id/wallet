import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

/**
 * Displays a generated install code as individual character boxes.
 */
export function CodeDisplay({ code }: { code: string }) {
    const { t } = useTranslation();

    return (
        <Stack space={"s"} align={"center"}>
            <Text variant="overline" color="secondary">
                {t("installCode.codeTitle")}
            </Text>
            <Inline space={"s"} align={"center"}>
                {code.split("").map((char, index) => (
                    <span key={index} className={styles.codeChar}>
                        {char}
                    </span>
                ))}
            </Inline>
            <Text variant="bodySmall" color="disabled">
                {t("installCode.codeDescription")}
            </Text>
        </Stack>
    );
}
