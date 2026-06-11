import { Button } from "@frak-labs/design-system/components/Button";
import { useTranslation } from "react-i18next";
import { FloatingFooter } from "@/module/common/component/FloatingFooter";
import * as layoutStyles from "@/module/merchant/component/EditPageLayout/edit-page-layout.css";
import * as styles from "./customize.css";

export function SaveFooter({
    disabled,
    isSaving,
    onSave,
}: {
    disabled: boolean;
    isSaving: boolean;
    onSave: () => void;
}) {
    const { t } = useTranslation();
    return (
        <FloatingFooter bare contentClassName={styles.saveFooterContent}>
            <div className={layoutStyles.gutter}>
                <div className={styles.saveFooterColumn}>
                    <Button
                        variant="primary"
                        size="large"
                        width="auto"
                        onClick={onSave}
                        disabled={disabled || isSaving}
                        loading={isSaving}
                    >
                        {t("customize.save")}
                    </Button>
                </div>
            </div>
        </FloatingFooter>
    );
}
