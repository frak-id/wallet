import { PlusIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { FloatingFooter } from "@/module/common/component/FloatingFooter";
import { LinkButton } from "@/module/common/component/LinkButton";

export function AddMerchantFooter() {
    const { t } = useTranslation();

    return (
        <FloatingFooter>
            <LinkButton
                to="/merchant/new"
                size="large"
                width="auto"
                icon={<PlusIcon width={24} height={24} />}
            >
                {t("shell.header.addMerchant")}
            </LinkButton>
        </FloatingFooter>
    );
}
