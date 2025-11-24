import { Plus } from "lucide-react";
import { LinkButton } from "@/module/common/component/LinkButton";
import { pushCreationStore } from "@/stores/pushCreationStore";

export function ButtonSendPush() {
    const setForm = pushCreationStore((state) => state.setForm);

    return (
        <LinkButton
            to="/push/create"
            onClick={() => setForm(undefined)}
            leftIcon={<Plus size={20} />}
        >
            Send Push
        </LinkButton>
    );
}
