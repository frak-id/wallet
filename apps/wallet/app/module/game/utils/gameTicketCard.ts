import type { CurrentGameResponse } from "@frak-labs/backend-elysia/domain/game/schemas";
import { type Mission, missionsOf } from "@/module/game/utils/gameMissions";

export type TicketCardStatus =
    | { kind: "join" }
    | { kind: "locked"; mission: Mission }
    | { kind: "next"; mission: Mission }
    | { kind: "allDone" };

/** What the home card's status line says and leads to. */
export function ticketCardOf(me: CurrentGameResponse["me"]): TicketCardStatus {
    if (!me.participating) return { kind: "join" };
    const missions = missionsOf(me);
    const todo = missions.filter((mission) => mission.status !== "done");
    if (!me.eligible) {
        const mission =
            missions.find((candidate) => candidate.status === "gate") ??
            todo[0];
        if (mission) return { kind: "locked", mission };
    }
    const [mission] = todo;
    return mission ? { kind: "next", mission } : { kind: "allDone" };
}
