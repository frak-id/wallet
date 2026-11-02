import type { CurrentGameResponse } from "@frak-labs/backend-elysia/domain/game/schemas";
import {
    type Mission,
    missionsOf,
    nextMissionOf,
} from "@/module/game/utils/gameMissions";

export type TicketCardStatus =
    | { kind: "join" }
    | { kind: "locked"; mission: Mission }
    | { kind: "next"; mission: Mission }
    | { kind: "allDone" };

/** What the home card's status line says and leads to. */
export function ticketCardOf(me: CurrentGameResponse["me"]): TicketCardStatus {
    if (!me.participating) return { kind: "join" };
    const mission = nextMissionOf(missionsOf(me));
    if (!mission) return { kind: "allDone" };
    return { kind: me.eligible ? "next" : "locked", mission };
}
