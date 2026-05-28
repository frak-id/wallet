export type SdkReferralEventMap = {
    user_referred_started: {
        referrer?: string;
        referrer_client_id?: string;
        referrer_wallet?: string;
        wallet_status?: string;
    };
    user_referred_completed: {
        status: "success";
    };
};
