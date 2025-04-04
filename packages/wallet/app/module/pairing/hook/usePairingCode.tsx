import { pairingCodeAtom } from "@/module/pairing/atoms/code";
import { useAtom } from "jotai";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";

/**
 * Hook to get the pairing code from the URL
 * @returns The pairing code
 */
export function usePairingCode() {
    const [searchParams] = useSearchParams();
    const [pairingCode, setPairingCode] = useAtom(pairingCodeAtom);
    const code = useMemo(() => searchParams.get("code"), [searchParams]);

    useEffect(() => {
        if (!code) return;
        setPairingCode(code);
    }, [code, setPairingCode]);

    return useMemo(() => ({ pairingCode }), [pairingCode]);
}
