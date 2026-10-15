import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isMoneriumEnabled } from "@/module/monerium/utils/moneriumConfig";
import { modalStore } from "@/module/stores/modalStore";

/** Opens the bank flow once for `/wallet?open=monerium`, then strips the param. */
export function useOpenMoneriumFromLink(open: "monerium" | undefined) {
    const navigate = useNavigate();

    useEffect(() => {
        if (open !== "monerium") return;
        if (isMoneriumEnabled) {
            modalStore.getState().openModal({ id: "moneriumBankFlow" });
        }
        navigate({ to: "/wallet", search: {}, replace: true });
    }, [open, navigate]);
}
