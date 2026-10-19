import type { Leaderboard } from "@/module/game/types";

const mockedLeaderboard: Leaderboard = {
    entries: [
        { rank: 1, displayName: "Camille D.", score: 4820, isMe: false },
        { rank: 2, displayName: "Lucas_92", score: 4310, isMe: false },
        { rank: 3, displayName: "Manon B.", score: 3975, isMe: false },
        { rank: 4, displayName: "Hugo.L", score: 3640, isMe: false },
        { rank: 5, displayName: "Léa M.", score: 3120, isMe: false },
        { rank: 6, displayName: "Théo_75", score: 2890, isMe: false },
        { rank: 7, displayName: "0x12ab…cd34", score: 2455, isMe: false },
        { rank: 8, displayName: "Nathan.P", score: 2210, isMe: false },
        { rank: 9, displayName: "Inès T.", score: 1980, isMe: false },
        { rank: 10, displayName: "Jules_33", score: 1745, isMe: false },
    ],
    me: { rank: 23, score: 860 },
};

export async function getLeaderboard(): Promise<Leaderboard> {
    // shortcut: mocked until FRA-368 ships the leaderboard endpoint, then replace this body with the API call
    return mockedLeaderboard;
}
