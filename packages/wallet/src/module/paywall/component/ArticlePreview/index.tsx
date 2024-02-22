import { Panel } from "@/module/common/component/Panel";
import { usePaywall } from "@/module/paywall/provider";
import styles from "./index.module.css";

export function ArticlePreview() {
    const { context } = usePaywall();

    if (!context) return null;
    return (
        <Panel
            size={"normal"}
            cover={context.imageUrl}
            className={styles.articlePreview}
        >
            <div className={styles.articlePreview__blur} />
            <div className={styles.articlePreview__content}>
                <p>
                    <strong>{context.articleTitle}</strong>
                </p>
                <p>
                    From: <strong>{context.contentTitle}</strong>
                </p>
            </div>
        </Panel>
    );
}
