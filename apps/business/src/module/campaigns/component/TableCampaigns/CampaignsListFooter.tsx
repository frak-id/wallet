import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import * as styles from "./campaigns-list-footer.css";

/**
 * Floating bottom bar with the "Create new campaign" CTA. Pinned to the
 * viewport so it stays visible while the campaign list scrolls underneath
 * (matches the Figma "bottom fix" frame).
 */
export function CampaignsListFooter() {
    return (
        <div className={styles.footer}>
            <div className={styles.scrollEdge} />
            <div className={styles.buttonWrapper}>
                <ButtonNewCampaign size="large" />
            </div>
        </div>
    );
}
