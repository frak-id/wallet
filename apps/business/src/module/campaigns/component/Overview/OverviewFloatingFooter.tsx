import { ArrowRightIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { LinkButton } from "@/module/common/component/LinkButton";
import { useOptionalActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import * as styles from "./overview.css";

export function OverviewFloatingFooter() {
    const { t } = useTranslation();
    const merchantId = useOptionalActiveMerchantId();
    if (!merchantId) return null;
    return (
        <div className={styles.floatingFooter}>
            <div className={styles.floatingFooterEdge} />
            <div className={styles.floatingFooterButtonWrap}>
                <LinkButton
                    to="/m/$merchantId/campaigns/list"
                    params={{ merchantId }}
                    size="large"
                    rightIcon={<ArrowRightIcon width={16} height={16} />}
                >
                    {t("campaigns.overview.footer.viewAll")}
                </LinkButton>
            </div>
        </div>
    );
}
