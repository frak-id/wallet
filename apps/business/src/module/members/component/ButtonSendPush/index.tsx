import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
    LinkButton,
    type LinkButtonProps,
} from "@/module/common/component/LinkButton";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { pushCreationStore } from "@/stores/pushCreationStore";

export function ButtonSendPush({
    size,
    children,
}: {
    size?: LinkButtonProps["size"];
    children?: ReactNode;
}) {
    const { t } = useTranslation();
    const setForm = pushCreationStore((state) => state.setForm);
    const merchantId = useActiveMerchantId();

    return (
        <LinkButton
            to="/m/$merchantId/push/create"
            params={{ merchantId }}
            onClick={() => setForm(undefined)}
            icon={<Plus size={20} />}
            size={size}
        >
            {children ?? t("members.sendPushNotification")}
        </LinkButton>
    );
}
