import { Link } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";

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
                        pLink: <Link to={"/login"} viewTransition />,
                    }}
                />
            </p>
        </AccordionRecoveryItem>
    );
}
