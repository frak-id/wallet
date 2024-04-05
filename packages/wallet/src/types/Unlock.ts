import type { Hex } from "viem";

export type UnlockSuccessData = Readonly<{
    redirectUrl: string;
    userOpHash: Hex;
    userOpExplorerLink: string;
}>;

export type PaywallUnlockUiState =
    | {
          idle: true;
          already?: never;
          success?: never;
          error?: never;
          loading?: never;
      }
    | {
          idle?: never;
          already: {
              redirectUrl: string;
              expireIn: string;
          };
          success?: never;
          error?: never;
          loading?: never;
      }
    | {
          idle?: never;
          success: {
              redirectUrl: string;
              userOpHash: Hex;
              userOpExplorerLink: string;
          };
          already?: never;
          error?: never;
          loading?: never;
      }
    | {
          idle?: never;
          error: {
              reason: string;
          };
          already?: never;
          success?: never;
          loading?: never;
      }
    | {
          idle?: never;
          loading: {
              info: "checkingParams" | "buildingTx" | "pendingSignature";
          };
          already?: never;
          error?: never;
          success?: never;
      };
