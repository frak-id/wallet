import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
    extractCodeCandidates,
    extractTextMessages,
    instagramLevelOf,
    isDrawEligible,
    isMockIgsid,
    isValidMetaSignature,
    isVerifiedFollower,
    mockIgsidOf,
    normalizeInstagramHandle,
    pickSurvivingDeclaration,
    pickSurvivingLink,
} from "./utils";

describe("normalizeInstagramHandle", () => {
    it.each([
        ["frak_fr", "frak_fr"],
        ["@Frak_FR", "frak_fr"],
        ["  @some.user_01  ", "some.user_01"],
        ["a".repeat(30), "a".repeat(30)],
    ])("accepts %j as %j", (raw, expected) => {
        expect(normalizeInstagramHandle(raw)).toBe(expected);
    });

    it.each([
        ["empty", ""],
        ["only an @", "@"],
        ["a space inside", "frak fr"],
        ["a dash", "frak-fr"],
        ["an accent", "frák"],
        ["a url", "instagram.com/frak_fr"],
        ["over 30 characters", "a".repeat(31)],
    ])("rejects %s", (_name, raw) => {
        expect(normalizeInstagramHandle(raw)).toBeNull();
    });
});

describe("mockIgsidOf", () => {
    it("is stable per handle and never looks like a Meta id", () => {
        expect(mockIgsidOf("frak_fr")).toBe(mockIgsidOf("frak_fr"));
        expect(mockIgsidOf("frak_fr")).not.toBe(mockIgsidOf("other"));
        expect(mockIgsidOf("frak_fr")).toMatch(/^mock_/);
    });
});

const ANCHOR = "anchor";
const link = (
    id: string,
    over: Partial<{
        identityGroupId: string;
        follows: boolean;
        checkedAt: Date;
    }> = {}
) => ({
    id,
    identityGroupId: id,
    follows: false,
    checkedAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
});

describe("pickSurvivingLink", () => {
    it("returns null when nobody linked anything", () => {
        expect(pickSurvivingLink([], ANCHOR)).toBeNull();
    });

    it("keeps the only link, whichever group holds it", () => {
        const loser = link("loser");

        expect(pickSurvivingLink([loser], ANCHOR)).toBe(loser);
    });

    it("prefers a follower over the anchor's own non-follower", () => {
        const anchor = link(ANCHOR);
        const loser = link("loser", { follows: true });

        expect(pickSurvivingLink([anchor, loser], ANCHOR)).toBe(loser);
    });

    it("prefers the anchor's link when both follow", () => {
        const anchor = link(ANCHOR, { follows: true });
        const loser = link("loser", {
            follows: true,
            checkedAt: new Date("2026-10-20T00:00:00Z"),
        });

        expect(pickSurvivingLink([loser, anchor], ANCHOR)).toBe(anchor);
    });

    it("takes the freshest check among losers when the anchor has none", () => {
        const stale = link("stale");
        const fresh = link("fresh", {
            checkedAt: new Date("2026-10-20T00:00:00Z"),
        });

        expect(pickSurvivingLink([stale, fresh], ANCHOR)).toBe(fresh);
    });

    it("breaks a full tie by id so the survivor does not depend on row order", () => {
        const a = link("a");
        const b = link("b");

        expect(pickSurvivingLink([b, a], ANCHOR)).toBe(a);
        expect(pickSurvivingLink([a, b], ANCHOR)).toBe(a);
    });
});

describe("pickSurvivingDeclaration", () => {
    const declaration = (id: string, day: number) => ({
        id,
        identityGroupId: id,
        declaredAt: new Date(
            `2026-10-${String(day).padStart(2, "0")}T00:00:00Z`
        ),
    });

    it("returns null when nobody declared anything", () => {
        expect(pickSurvivingDeclaration([], ANCHOR)).toBeNull();
    });

    it("keeps the anchor's own declaration over a newer one", () => {
        const anchor = declaration(ANCHOR, 1);
        const loser = declaration("loser", 20);

        expect(pickSurvivingDeclaration([loser, anchor], ANCHOR)).toBe(anchor);
    });

    it("keeps the latest among losers when the anchor declared nothing", () => {
        const older = declaration("older", 1);
        const newer = declaration("newer", 20);

        expect(pickSurvivingDeclaration([older, newer], ANCHOR)).toBe(newer);
    });
});

describe("Instagram levels", () => {
    const declared = { username: "someone" };

    it.each([
        ["nothing", null, null, "none", false],
        ["a declaration", null, declared, "declared", true],
        ["a certified follower", { follows: true }, null, "certified", true],
        [
            "a certified non-follower",
            { follows: false },
            null,
            "certified",
            false,
        ],
        [
            "a certified non-follower with a stale declaration",
            { follows: false },
            declared,
            "certified",
            false,
        ],
    ] as const)("reads %s", (_name, link, declaration, level, eligible) => {
        expect(instagramLevelOf(link, declaration)).toBe(level);
        expect(isDrawEligible(link, declaration)).toBe(eligible);
    });

    it.each([
        ["no link", null, false],
        ["a link that does not follow", { follows: false }, false],
        ["a link that follows", { follows: true }, true],
    ])("pays only a certified follower: %s", (_name, link, expected) => {
        expect(isVerifiedFollower(link)).toBe(expected);
    });

    it("tells mock links apart", () => {
        expect(isMockIgsid(mockIgsidOf("frak_fr"))).toBe(true);
        expect(isMockIgsid("17841400000000000")).toBe(false);
    });
});

describe("extractCodeCandidates", () => {
    it.each([
        ["the code alone", "K7Q2PX", ["K7Q2PX"]],
        ["lowercase with spaces", "  k7q2px  ", ["K7Q2PX"]],
        [
            "inside a sentence",
            "Salut ! voici mon code: K7Q2PX merci",
            ["K7Q2PX"],
        ],
        ["next to punctuation", "(K7Q2PX).", ["K7Q2PX"]],
    ])("finds %s", (_name, text, expected) => {
        expect(extractCodeCandidates(text)).toEqual(expected);
    });

    it.each([
        ["inside a longer word", "AK7Q2PXB"],
        ["with a letter outside the code alphabet", "K7Q2PO"],
        ["too short", "K7Q2P"],
        ["nothing", ""],
    ])("ignores a code %s", (_name, text) => {
        expect(extractCodeCandidates(text)).toEqual([]);
    });

    it("dedupes and caps the candidates of a long message", () => {
        const words = Array.from(
            { length: 15 },
            (_, i) => `AAAA${"23456789ABCDEFGH"[i]}${"2"}`
        );
        const found = extractCodeCandidates(`K7Q2PX k7q2px ${words.join(" ")}`);

        expect(found[0]).toBe("K7Q2PX");
        expect(found).toHaveLength(10);
        expect(new Set(found).size).toBe(10);
    });
});

describe("isValidMetaSignature", () => {
    const SECRET = "instagram-app-secret";
    const BODY = '{"object":"instagram","entry":[]}';
    const sign = (body: string, secret = SECRET) =>
        `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    it("accepts Meta's signature of the exact body", () => {
        expect(isValidMetaSignature(BODY, sign(BODY), SECRET)).toBe(true);
    });

    it("accepts an uppercase digest", () => {
        expect(
            isValidMetaSignature(
                BODY,
                sign(BODY).toUpperCase().replace("SHA256", "sha256"),
                SECRET
            )
        ).toBe(true);
    });

    it.each([
        ["a signature made with another secret", sign(BODY, "other-secret")],
        ["the signature of a body changed by one byte", sign(`${BODY} `)],
        ["a missing header", undefined],
        [
            "a header without its sha256= prefix",
            sign(BODY).slice("sha256=".length),
        ],
        ["an empty digest", "sha256="],
    ])("rejects %s", (_name, header) => {
        expect(isValidMetaSignature(BODY, header, SECRET)).toBe(false);
    });
});

describe("extractTextMessages", () => {
    const ACCOUNT = "17841400000000001";
    const delivery = (...messaging: unknown[]) => ({
        object: "instagram",
        entry: [{ id: ACCOUNT, time: 1, messaging }],
    });

    it("reads the sender and text of a DM and of a story reply", () => {
        const payload = delivery(
            {
                sender: { id: "igsid-1" },
                recipient: { id: ACCOUNT },
                message: { mid: "m1", text: "K7Q2PX" },
            },
            {
                sender: { id: "igsid-2" },
                recipient: { id: ACCOUNT },
                message: {
                    mid: "m2",
                    text: "trop bien",
                    reply_to: { story: { id: "s", url: "u" } },
                },
            }
        );

        expect(extractTextMessages(payload)).toEqual([
            { igsid: "igsid-1", text: "K7Q2PX" },
            { igsid: "igsid-2", text: "trop bien" },
        ]);
    });

    it.each([
        [
            "an echo of our own message",
            { sender: { id: ACCOUNT }, message: { text: "hi", is_echo: true } },
        ],
        [
            "a referral from an ig.me link",
            {
                sender: { id: "igsid-1" },
                referral: {
                    ref: "K7Q2PX",
                    source: "SHORTLINK",
                    type: "OPEN_THREAD",
                },
            },
        ],
        [
            "a message without text",
            {
                sender: { id: "igsid-1" },
                message: { mid: "m", attachments: [] },
            },
        ],
        ["an item without a sender", { message: { text: "K7Q2PX" } }],
    ])("drops %s", (_name, item) => {
        expect(extractTextMessages(delivery(item))).toEqual([]);
    });

    it.each([
        ["another object", { object: "page", entry: [] }],
        ["no entry", { object: "instagram" }],
        ["null", null],
    ])("reads nothing from %s", (_name, payload) => {
        expect(extractTextMessages(payload)).toEqual([]);
    });
});
