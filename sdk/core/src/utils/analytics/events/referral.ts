export type SdkReferralEventMap = {
    user_referred_started: {
        referrer?: string;
        referrerClientId?: string;
        referrerWallet?: string;
        walletStatus?: string;
    };
    user_referred_completed: {
        status: "success";
    };
};
