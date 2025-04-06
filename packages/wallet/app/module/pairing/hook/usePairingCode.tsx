import { pendingPairingAtom } from "@/module/pairing/atoms/code";
import { useAtom } from "jotai";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";

/**
 * Hook to get the pairing code from the URL
 * @returns The pairing code
 */
export function usePairingCode() {
    const [searchParams] = useSearchParams();
    const [pairingCode, setPairingCode] = useAtom(pendingPairingAtom);
    const code = useMemo(() => searchParams.get("code"), [searchParams]);
    const id = useMemo(() => searchParams.get("id"), [searchParams]);

    useEffect(() => {
        if (!code || !id) return;
        setPairingCode({ id, code });
    }, [code, id, setPairingCode]);

    return useMemo(() => ({ pairingCode }), [pairingCode]);
}
