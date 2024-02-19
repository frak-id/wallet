import type { Hex } from "viem";

export type UnlockSuccessData = Readonly<{
    redirectUrl: string;
    userOpHash: Hex;
    userOpExplorerLink: string;
}>;

export type UiState =
    | {
          already: {
              redirectUrl: string;
              expireIn: string;
          };
          success?: never;
          error?: never;
          loading?: never;
      }
    | {
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
          error: {
              reason: string;
          };
          already?: never;
          success?: never;
          loading?: never;
      }
    | {
          loading: {
              info:
                  | "idle"
                  | "checkingParams"
                  | "buildingTx"
                  | "pendingSignature";
          };
          already?: never;
          error?: never;
          success?: never;
      };
