import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { CopyIcon } from "@frak-labs/design-system/icons";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

/**
 * Displays a generated install code with copy-to-clipboard button.
 */
export function CodeDisplay({ code }: { code: string }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [code]);

    return (
        <Stack space={"m"} align={"center"}>
            <Inline space={"s"} align={"center"}>
                {code.split("").map((char, index) => (
                    <span key={index} className={styles.codeChar}>
                        {char}
                    </span>
                ))}
            </Inline>
            <Button
                variant={"secondary"}
                size={"small"}
                onClick={handleCopy}
                icon={<CopyIcon />}
            >
                {copied
                    ? t("installCode.codeCopied")
                    : t("installCode.copyCode")}
            </Button>
        </Stack>
    );
}
