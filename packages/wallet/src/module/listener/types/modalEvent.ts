import type { SiweAuthenticateListenerParam } from "@/module/listener/types/auth";
import type { SendTransactionListenerParam } from "@/module/listener/types/transaction";

/**
 * Represent listener modal data
 */
export type modalEventRequestArgs =
    | {
          type: "auth";
          listener: SiweAuthenticateListenerParam;
      }
    | {
          type: "transaction";
          listener: SendTransactionListenerParam;
      };
