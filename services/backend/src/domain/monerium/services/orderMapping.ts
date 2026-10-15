import { normalizeIban } from "@frak-labs/app-essentials/monerium";
import type { MoneriumOrderDto } from "../schemas";
import type { MoneriumOrderRecord } from "./MoneriumApiClient";

export const MAX_BENEFICIARIES = 20;

export type MoneriumBeneficiary = {
    iban: string;
    own: boolean;
    firstName?: string;
    lastName?: string;
    country?: string;
    lastUsedAt: string;
};

export function toOrderDto(record: MoneriumOrderRecord): MoneriumOrderDto {
    const details = record.counterpart.details ?? {};
    const counterpart: MoneriumOrderDto["counterpart"] = {
        own: details.own === true,
    };
    if (record.counterpart.identifier?.iban) {
        counterpart.iban = record.counterpart.identifier.iban;
    }
    if (details.firstName) counterpart.firstName = details.firstName;
    if (details.lastName) counterpart.lastName = details.lastName;
    if (details.companyName) counterpart.companyName = details.companyName;
    if (details.country) counterpart.country = details.country;

    const dto: MoneriumOrderDto = {
        id: record.id,
        kind: record.kind,
        state: record.state,
        amount: record.amount,
        currency: record.currency,
        chain: record.chain,
        address: record.address,
        counterpart,
        placedAt: record.meta.placedAt,
        txHashes: record.meta.txHashes ?? [],
    };
    if (record.memo) dto.memo = record.memo;
    if (record.meta.processedAt) dto.processedAt = record.meta.processedAt;
    if (record.meta.rejectedReason) {
        dto.rejectedReason = record.meta.rejectedReason;
    }
    return dto;
}

export function sortNewestFirst(
    orders: MoneriumOrderDto[]
): MoneriumOrderDto[] {
    return [...orders].sort(
        (a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt)
    );
}

/** Past payout targets, unique by normalized IBAN, newest first. Derived per request, never stored. */
export function deriveBeneficiaries(
    orders: MoneriumOrderDto[]
): MoneriumBeneficiary[] {
    const seen = new Set<string>();
    const beneficiaries: MoneriumBeneficiary[] = [];
    for (const order of sortNewestFirst(orders)) {
        if (
            order.kind !== "redeem" ||
            order.state === "rejected" ||
            !order.counterpart.iban
        ) {
            continue;
        }
        const iban = normalizeIban(order.counterpart.iban);
        if (seen.has(iban)) continue;
        seen.add(iban);

        const { own, firstName, lastName, country } = order.counterpart;
        beneficiaries.push({
            iban,
            own,
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            ...(country ? { country } : {}),
            lastUsedAt: order.placedAt,
        });
        if (beneficiaries.length === MAX_BENEFICIARIES) break;
    }
    return beneficiaries;
}
