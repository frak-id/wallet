import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import Link from "next/link";
import { Trans, useTranslation } from "react-i18next";

const ACTUAL_STEP = 6;

export function Step6() {
    const { t } = useTranslation();
    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recovery.step6")}
        >
            <p>
                <Trans
                    i18nKey={"wallet.recovery.successful"}
                    components={{
                        pLink: <Link href={"/login"} />,
                    }}
                />
            </p>
        </AccordionRecoveryItem>
    );
}
