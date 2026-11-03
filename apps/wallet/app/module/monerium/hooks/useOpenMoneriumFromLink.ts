import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { modalStore } from "@/module/stores/modalStore";

/** Opens the bank flow once for `/wallet?open=monerium`, then strips the param. */
export function useOpenMoneriumFromLink(open: "monerium" | undefined) {
    const navigate = useNavigate();

    useEffect(() => {
        if (open !== "monerium") return;
        modalStore.getState().openModal({ id: "moneriumBankFlow" });
        navigate({ to: "/wallet", search: {}, replace: true });
    }, [open, navigate]);
}
