import { describe, expect, it } from "vitest";
import {
    INSTALL_TICKET_CLIENT_TTL_MS,
    INSTALL_TICKET_SERVER_TTL_MS,
} from "./installTicket";

describe("install ticket TTLs", () => {
    it("never lets the store expire before the ticket it carries", () => {
        expect(INSTALL_TICKET_CLIENT_TTL_MS).toBeGreaterThanOrEqual(
            INSTALL_TICKET_SERVER_TTL_MS
        );
    });

    it("keeps both at one week until a coordinated release moves them", () => {
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        expect(INSTALL_TICKET_CLIENT_TTL_MS).toBe(oneWeek);
        expect(INSTALL_TICKET_SERVER_TTL_MS).toBe(oneWeek);
    });
});
