/** Where a signed-in user lands with a shared code: the game join screen. */
export function redeemCodeRoute(code: string) {
    return {
        to: "/game/join",
        search: { code },
    } as const;
}
