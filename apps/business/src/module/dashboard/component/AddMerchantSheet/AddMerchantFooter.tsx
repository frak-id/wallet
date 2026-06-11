import { Button } from "@frak-labs/design-system/components/Button";
import { PlusIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { FloatingFooter } from "@/module/common/component/FloatingFooter";
import { AddMerchantSheet } from "@/module/dashboard/component/AddMerchantSheet";

export function AddMerchantFooter() {
    const { t } = useTranslation();

    return (
        <FloatingFooter>
            <AddMerchantSheet
                trigger={
                    <Button
                        size="large"
                        width="auto"
                        icon={<PlusIcon width={24} height={24} />}
                    >
                        {t("shell.header.addMerchant")}
                    </Button>
                }
            />
        </FloatingFooter>
    );
}
