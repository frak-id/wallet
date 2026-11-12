export type DrawSearch = {
    /** The game's id, only when it is a UUID the draw endpoint can answer. */
    game?: string;
    pid?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PID_MAX_LENGTH = 128;

const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

/** `/draw`'s search: anything unusable is dropped, never thrown. */
export function parseDrawSearch(search: Record<string, unknown>): DrawSearch {
    const game = text(search.game);
    const pid = text(search.pid);
    return {
        game: game && UUID.test(game) ? game.toLowerCase() : undefined,
        pid: pid && pid.length <= PID_MAX_LENGTH ? pid : undefined,
    };
}
