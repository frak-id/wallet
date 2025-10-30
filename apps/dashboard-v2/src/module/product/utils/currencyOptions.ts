export const currencyOptions = [
    {
        group: "Monerium",
        description: "Best for easy IBAN transfer for end users",
        options: [
            { value: "eure", label: "EURe" },
            { value: "gbpe", label: "GBPe" },
            { value: "usde", label: "USDe" },
        ],
    },
    {
        group: "Circle",
        description: "Best for blockchain usage for end users",
        options: [{ value: "usdc", label: "USDC" }],
    },
] as const;
