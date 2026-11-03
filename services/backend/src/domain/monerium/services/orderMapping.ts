import {
    isPayableCounterpart,
    normalizeIban,
} from "@frak-labs/app-essentials/monerium";
import type { MoneriumBeneficiaryDto, MoneriumOrderDto } from "../schemas";
import type { MoneriumOrderRecord } from "./MoneriumApiClient";

const MAX_BENEFICIARIES = 20;

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

function canBePaidAgain(order: MoneriumOrderDto): boolean {
    if (
        order.kind !== "redeem" ||
        order.state === "rejected" ||
        !order.counterpart.iban
    ) {
        return false;
    }
    return isPayableCounterpart(order.counterpart);
}

/** Past payout targets, unique by normalized IBAN, newest first. Third parties without both names cannot be paid again and are dropped. */
export function deriveBeneficiaries(
    orders: MoneriumOrderDto[]
): MoneriumBeneficiaryDto[] {
    const seen = new Set<string>();
    const beneficiaries: MoneriumBeneficiaryDto[] = [];
    for (const order of sortNewestFirst(orders)) {
        const {
            iban: rawIban,
            own,
            firstName,
            lastName,
            country,
        } = order.counterpart;
        if (!rawIban || !canBePaidAgain(order)) continue;
        const iban = normalizeIban(rawIban);
        if (seen.has(iban)) continue;
        seen.add(iban);

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
