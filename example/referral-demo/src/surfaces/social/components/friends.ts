/** Fictional people around Léa and Chloé: contacts and Instagram follows. */
export type Friend = {
    handle: string;
    name: string;
    /** Two-stop gradient behind the initials. */
    tones: readonly [string, string];
};

export const friends = {
    camille: {
        handle: "camille.dlr",
        name: "Camille",
        tones: ["#f6d365", "#fda085"],
    },
    hugo: { handle: "hugo.prt", name: "Hugo", tones: ["#84fab0", "#3fa7d6"] },
    ines: { handle: "ines_bm", name: "Inès", tones: ["#e0c3fc", "#8ec5fc"] },
    thomas: {
        handle: "thomas.lgd",
        name: "Thomas",
        tones: ["#a1c4fd", "#4f6fa8"],
    },
    manon: {
        handle: "manon.vrt",
        name: "Manon",
        tones: ["#ffc3a0", "#d16b86"],
    },
} as const satisfies Record<string, Friend>;
