"use client";

import { Button } from "@frak-labs/ui/component/Button";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { pushCreationStore } from "@/stores/pushCreationStore";

export function ButtonSendPush() {
    const setForm = pushCreationStore((state) => state.setForm);
    const router = useRouter();

    return (
        <Button
            leftIcon={<Plus size={20} />}
            onClick={() => {
                setForm(undefined);
                router.push("/push/create");
            }}
        >
            Send Push
        </Button>
    );
}
