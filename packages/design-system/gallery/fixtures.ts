/** Worst-case inputs shared by every section. */
export const fixtures = {
    unbreakableEmail:
        "firstname.lastname.example@averylongsubdomain123.example.org",
    singleChar: "A",
    empty: "",
    hugeNumber: "1234567890123456789012345",
    nonLatin:
        "日本語のとても長いテキスト مرحبا بالعالم Привет мир 🎉🚀👨‍👩‍👧‍👦",
    longSentence:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
} as const;

export const chartFixtures = {
    revenue: [
        { date: new Date("2026-01-01T00:00:00Z"), actual: 1200 },
        { date: new Date("2026-02-01T00:00:00Z"), actual: 3400 },
        { date: new Date("2026-03-01T00:00:00Z"), actual: 2900 },
        { date: new Date("2026-04-01T00:00:00Z"), actual: 6100 },
        { date: new Date("2026-05-01T00:00:00Z"), actual: 8800 },
        {
            date: new Date("2026-06-01T00:00:00Z"),
            actual: 9700,
            forecast: 9700,
        },
        { date: new Date("2026-07-01T00:00:00Z"), forecast: 11800 },
        { date: new Date("2026-08-01T00:00:00Z"), forecast: 13900 },
    ],
    purchases: [
        { label: "Jan", value: 1200 },
        { label: "Feb", value: 3400 },
        { label: "Mar", value: 2900 },
        { label: "Apr", value: 4600 },
        { label: "May", value: 3800 },
        { label: "Jun", value: 5000 },
    ],
    daily: [
        { label: "Sep 01", value: 12 },
        { label: "Sep 02", value: 30 },
        { label: "Sep 03", value: 18 },
        { label: "Sep 04", value: 44 },
        { label: "Sep 05", value: 27 },
        { label: "Sep 06", value: 9 },
        { label: "Sep 07", value: 36 },
    ],
} as const;
