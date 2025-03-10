"use client";

import { currentPushCreationForm } from "@/module/members/atoms/pushCreationForm";
import { Button } from "@shared/module/component/Button";
import { useSetAtom } from "jotai";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

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
