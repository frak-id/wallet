import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";
import { Route } from "./_protected";

type BeforeLoad = (ctx: {
    location: { pathname: string; search: string };
}) => Promise<void>;

async function hitSignedOut(pathname: string, search = "") {
    const beforeLoad = Route.options.beforeLoad as unknown as BeforeLoad;
    await beforeLoad({ location: { pathname, search } }).catch(() => {});
    return pendingActionsStore
        .getState()
        .getValidActions()
        .map((a) => (a.type === "navigation" ? [a.to, a.search] : a.type));
}

describe("protected layout guard, signed out", () => {
    beforeEach(() => {
        sessionStore.getState().clearSession();
        pendingActionsStore.getState().clearAll();
    });

    test("does not queue the default /wallet landing", async () => {
        expect(await hitSignedOut("/wallet")).toEqual([]);
    });

    test("queues a real destination", async () => {
        expect(await hitSignedOut("/history")).toEqual([
            ["/history", undefined],
        ]);
    });

    test("queues /wallet when it carries a search", async () => {
        expect(await hitSignedOut("/wallet", "?open=monerium")).toEqual([
            ["/wallet", { open: "monerium" }],
        ]);
    });
});
