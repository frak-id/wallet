"use client";

import { Button } from "@frak-labs/ui/component/Button";
import { useSetAtom } from "jotai";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { currentPushCreationForm } from "@/module/members/atoms/pushCreationForm";

export function ButtonSendPush() {
    const setCurrentPushCreationForm = useSetAtom(currentPushCreationForm);
    const router = useRouter();

    return (
        <Button
            leftIcon={<Plus size={20} />}
            onClick={() => {
                setCurrentPushCreationForm(undefined);
                router.push("/push/create");
            }}
        >
            Send Push
        </Button>
    );
}
