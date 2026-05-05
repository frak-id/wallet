// Backend `/user/wallet/referral/status` doesn't expose the redeemed code
// text yet — both the hub row and the active-redemption card render this
// placeholder until that follow-up lands (extend `/status` to return
// `redeemedCode: { code, redeemedAt }` joined via referral_links →
// referral_codes on sourceData.codeId).
export const REDEEMED_CODE_PLACEHOLDER = "——————";
