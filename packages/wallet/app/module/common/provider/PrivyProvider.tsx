import { createContext, useContext } from "react";
import type { Address, Hex } from "viem";

/**
 * A shared privy context, with some base stuff depending on the implementation
 *  - Can be implemented by the privy embedded client (wallet context)
 *  - Or via the privy cross app client (SDK context)
 */
export type PrivyContextType = {
    /**
     * The current logged in wallet
     */
    wallet?: Address;
    /**
     * Launch the privy login process, and return the logged in ecdsa address
     */
    login: () => Promise<Address>;
    /**
     * Sign a message via privy
     * @param args
     */
    signMessage: (args: { hash: Hex; address: Address }) => Promise<Hex>;
    /**
     * Launch the logout process
     */
    logout: () => Promise<void>;
};

export const PrivyContext = createContext<PrivyContextType | undefined>(
    undefined
);

export const usePrivyContext = () => {
    const context = useContext(PrivyContext);
    if (!context) {
        throw new Error(
            "usePrivy must be used within a PrivyWalletProvider or PrivySdkProvider"
        );
    }
    return context;
};
