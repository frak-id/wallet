import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { PlusIcon } from "@frak-labs/design-system/icons";
import { useT } from "@/i18n";
import { sharingMessages } from "../messages";
import * as styles from "./sharingPage.css";

const QUESTIONS = [
    "faqQ1",
    "faqQ2",
    "faqQ3",
    "faqQ4",
    "faqQ5",
    "faqQ6",
] as const;

/** The FAQ, collapsed: nobody opens it on stage. */
export function Faq() {
    const t = useT(sharingMessages);
    return (
        <Stack as="section" space="m" className={styles.faqWrapper}>
            <Text as="h3" variant="heading2">
                {t("faqTitle")}
            </Text>
            <ul className={styles.faqList}>
                {QUESTIONS.map((key) => (
                    <li key={key} className={styles.faqItem}>
                        {t(key)}
                        <PlusIcon
                            width={20}
                            height={20}
                            className={styles.faqIcon}
                        />
                    </li>
                ))}
            </ul>
        </Stack>
    );
}
