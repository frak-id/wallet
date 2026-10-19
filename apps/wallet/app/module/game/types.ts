export type LeaderboardEntry = {
    rank: number;
    displayName: string;
    score: number;
    isMe: boolean;
};

export type Leaderboard = {
    entries: LeaderboardEntry[];
    me: { rank: number; score: number } | null;
};
