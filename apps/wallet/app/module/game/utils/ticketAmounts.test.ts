import { TICKET_AMOUNTS as BACKEND_AMOUNTS } from "@backend-domain/game/tickets";
import { describe, expect, it } from "vitest";
import { TICKET_AMOUNTS, totalTickets } from "./ticketAmounts";

describe("ticketAmounts", () => {
    it("matches the amounts the backend counts", () => {
        expect(TICKET_AMOUNTS).toEqual(BACKEND_AMOUNTS);
    });

    it("sums a breakdown", () => {
        expect(
            totalTickets({
                join: 1,
                instagramCertified: 2,
                purchase: 6,
                referredPurchase: 3,
                referredSignup: 2,
                brandShare: 1,
            })
        ).toBe(15);
    });
});
