import { useWalletStatus } from "@frak-labs/react-sdk";
import { useQuery } from "@tanstack/react-query";
import { type Address, isAddressEqual } from "viem";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

const MOCK_ADMINISTRATORS: MerchantAdministrator[] = [
    {
        id: "admin-1",
        wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as Address,
        addedBy: "0x0000000000000000000000000000000000000000" as Address,
        addedAt: "2024-01-01T00:00:00.000Z",
        isOwner: true,
        isMe: false,
    },
    {
        id: "admin-2",
        wallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199" as Address,
        addedBy: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as Address,
        addedAt: "2024-01-15T00:00:00.000Z",
        isOwner: false,
        isMe: false,
    },
    {
        id: "admin-3",
        wallet: "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1" as Address,
        addedBy: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as Address,
        addedAt: "2024-01-29T00:00:00.000Z",
        isOwner: false,
        isMe: false,
    },
];

export type MerchantAdministrator = {
    id: string;
    wallet: Address;
    addedBy: Address;
    addedAt: string;
    isOwner: boolean;
    isMe: boolean;
};

export function useGetMerchantAdministrators({
    merchantId,
}: {
    merchantId: string;
}) {
    const isDemoMode = useIsDemoMode();
    const { data: walletStatus } = useWalletStatus();

    return useQuery({
        queryKey: [
            "merchant",
            "team",
            merchantId,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: async (): Promise<MerchantAdministrator[]> => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 200));
                return MOCK_ADMINISTRATORS;
            }

            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .admins.get();

            if (!data || error) {
                console.warn("Error fetching admins", error);
                return [];
            }

            const currentWallet = walletStatus?.wallet;

            return data.admins.map((admin) => ({
                id: admin.id,
                wallet: admin.wallet as Address,
                addedBy: admin.addedBy as Address,
                addedAt: admin.addedAt,
                isOwner: admin.isOwner,
                isMe: currentWallet
                    ? isAddressEqual(admin.wallet as Address, currentWallet)
                    : false,
            }));
        },
        enabled: !!merchantId,
    });
}
