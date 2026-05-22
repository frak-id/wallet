import { Plus } from "lucide-react";
import { LinkButton } from "@/module/common/component/LinkButton";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { pushCreationStore } from "@/stores/pushCreationStore";

export function ButtonSendPush() {
    const setForm = pushCreationStore((state) => state.setForm);
    const merchantId = useActiveMerchantId();

    return (
        <LinkButton
            to="/m/$merchantId/push/create"
            params={{ merchantId }}
            onClick={() => setForm(undefined)}
            icon={<Plus size={20} />}
        >
            Send Push
        </LinkButton>
    );
}
