import { Button } from "@frak-labs/ui/component/Button";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { pushCreationStore } from "@/stores/pushCreationStore";

export function ButtonSendPush() {
    const setForm = pushCreationStore((state) => state.setForm);
    const navigate = useNavigate();

    return (
        <Button
            leftIcon={<Plus size={20} />}
            onClick={() => {
                setForm(undefined);
                navigate({ to: "/push/create" });
            }}
        >
            Send Push
        </Button>
    );
}
