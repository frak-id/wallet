import type { ProposalTypes, SessionTypes, Verify } from "@walletconnect/types";

/**
 * Represent wallet connect modal data
 */
export type WalletConnectRequestArgs = {
    id: number;
    verifyContext: Verify.Context;
} & (
    | {
          type: "pairing";
          params: ProposalTypes.Struct;
      }
    | {
          type: "request";
          topic: string;
          params: {
              request: {
                  method: string;
                  // biome-ignore lint/suspicious/noExplicitAny: Type from wallet connect interface
                  params: any;
              };
              chainId: string;
          };
          session: SessionTypes.Struct;
      }
);
