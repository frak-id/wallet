import {
    isValidCounterpartName,
    normalizeIban,
} from "@frak-labs/app-essentials/monerium";
import { authenticatedWalletApi, recordError } from "@frak-labs/wallet-shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useConnection } from "wagmi";
import { type IbanEntry, ibanStore } from "@/module/monerium/store/ibanStore";
import { maskIban } from "@/module/monerium/utils/maskIban";
import { unwrapMoneriumResponse } from "@/module/monerium/utils/moneriumErrors";

type Beneficiary = {
    iban: string;
    own: boolean;
    firstName?: string;
    lastName?: string;
    country?: string;
};

export function beneficiaryToIbanEntry(
    beneficiary: Beneficiary,
    ownLabel: string
): IbanEntry {
    const iban = normalizeIban(beneficiary.iban);
    const firstName = beneficiary.own ? "" : (beneficiary.firstName ?? "");
    const lastName = beneficiary.own ? "" : (beneficiary.lastName ?? "");
    const fullName = `${firstName} ${lastName}`.trim();
    return {
        iban,
        firstName,
        lastName,
        pseudo: beneficiary.own ? ownLabel : fullName || maskIban(iban),
        own: beneficiary.own,
        country: beneficiary.own ? undefined : beneficiary.country,
    };
}

/** Merges the server's past counterparts into the local store, then marks the wallet as synced. */
export async function syncMoneriumBeneficiaries(
    wallet: Address,
    ownLabel: string
): Promise<void> {
    const { beneficiaries } = unwrapMoneriumResponse(
        await authenticatedWalletApi.monerium.beneficiaries.get()
    );
    ibanStore.getState().mergeRemoteIbans(
        beneficiaries
            .filter(
                (b) =>
                    b.own ||
                    (isValidCounterpartName(b.firstName ?? "") &&
                        isValidCounterpartName(b.lastName ?? ""))
            )
            .map((b) => beneficiaryToIbanEntry(b, ownLabel)),
        wallet
    );
}

/** One-off per device and wallet: runs while the marker differs from the current wallet. */
export function useMoneriumBeneficiarySync(isConnected: boolean) {
    const { t } = useTranslation();
    const { address } = useConnection();
    const syncedWallet = ibanStore((s) => s.syncedWallet);
    const inFlightWallet = useRef<Address | null>(null);
    const ownLabel = t(
        "monerium.bankFlow.transfer.ibanManager.ownAccountLabel"
    );

    useEffect(() => {
        if (!isConnected || !address) return;
        if (syncedWallet?.toLowerCase() === address.toLowerCase()) return;
        if (inFlightWallet.current === address) return;

        inFlightWallet.current = address;
        syncMoneriumBeneficiaries(address, ownLabel)
            .catch((error) => recordError(error, { source: "monerium_api" }))
            .finally(() => {
                inFlightWallet.current = null;
            });
    }, [isConnected, address, syncedWallet, ownLabel]);
}
