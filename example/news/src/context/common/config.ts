import { type Hex, toHex } from "viem";

// le monde
const leMondeContentId: Hex =
    "0xead61c7340b7cacd78684d4795a617aae5e85cc4b89da34fb05ad55bb6bab653";

// l'equipe
const equipeContentId: Hex =
    "0xf011955832cac97ab1a6534c6b94971325e3be6bfaac1ccae68e3f5c7adcee5f";

// wired
const wiredContentId: Hex =
    "0x87c66b8c60fd984f739f68f1d83229601131914aaf269874c584e179b37db1a5";

export type PressProvider = "le-monde" | "l-equipe" | "wired";
export const providerToContentId: Record<PressProvider, Hex> = {
    "le-monde": leMondeContentId,
    "l-equipe": equipeContentId,
    wired: wiredContentId,
};

export const newsDemoContentId =
    toHex(
        8073960722007594212918575991467917289452723924551607525414094759273404023523n
    );
