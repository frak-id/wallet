import { Panel } from "@/module/common/component/Panel";
import { paywallContextAtom } from "@/module/paywall/atoms/paywallContext";
import { useAtomValue } from "jotai/index";
import styles from "./index.module.css";

export function ArticlePreview() {
    const paywallContext = useAtomValue(paywallContextAtom);

    if (!paywallContext) return null;
    return (
        <Panel
            size={"normal"}
            cover={paywallContext.imageUrl}
            className={styles.articlePreview}
        >
            <div className={styles.articlePreview__blur} />
            <div className={styles.articlePreview__content}>
                <p>
                    <strong>{paywallContext.articleTitle}</strong>
                </p>
                <p>
                    From: <strong>{paywallContext.contentTitle}</strong>
                </p>
            </div>
        </Panel>
    );
}
