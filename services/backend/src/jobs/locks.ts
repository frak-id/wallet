/** One settlement at a time across replicas: no double-pay, no rewarder nonce collision. */
export const SETTLEMENT_ADVISORY_LOCK_KEY = 0x5e771e;

/** One subscription resolver at a time across replicas: each pass calls the provider once per order. */
export const SUBSCRIPTION_RESOLUTION_ADVISORY_LOCK_KEY = 0x5b5c21;
