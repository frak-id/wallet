import type { DropSelect } from "./db/schema";

export function isDropOpen(
    drop: Pick<DropSelect, "status" | "startsAt" | "endsAt">,
    now: Date
): boolean {
    return (
        drop.status === "active" && drop.startsAt <= now && now < drop.endsAt
    );
}

/** One join per user per drop, enforced by the interaction idempotency index. */
export function dropJoinExternalEventId(
    dropId: string,
    identityGroupId: string
): string {
    return `drop:${dropId}:${identityGroupId}`;
}
