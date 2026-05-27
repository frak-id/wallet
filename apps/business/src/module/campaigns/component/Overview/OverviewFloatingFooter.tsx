import { LinkButton } from "@/module/common/component/LinkButton";
import { useOptionalActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import * as styles from "./overview.css";

export function OverviewFloatingFooter() {
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
                >
                    View all campaigns
                </LinkButton>
            </div>
        </div>
    );
}
