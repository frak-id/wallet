import { BILLING_RATES } from "@frak-labs/app-essentials/constants/billing";
import Decimal from "decimal.js";

export const FR_VAT_RATE = new Decimal(BILLING_RATES.FR_VAT_BPS).div(
    BILLING_RATES.BPS_DENOMINATOR
);
export const FRAK_FEE_RATE = new Decimal(BILLING_RATES.FRAK_FEE_BPS).div(
    BILLING_RATES.BPS_DENOMINATOR
);
