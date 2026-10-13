import Decimal from "decimal.js";
import { FRAK_FEE_RATE, VAT_RATE } from "./primitives";

export type GrossedUpBalance = {
    gross: string;
    vat: string;
    frakFee: string;
    available: string;
};

/**
 * Display-only inverse of the deposit math (same formula as the dashboards'
 * `grossUpBankBalance`): the ledger holds the amount available for rewards,
 * so `gross = available / (1 - fee) * (1 + vat)`. Each line is rounded to 2dp
 * first and `gross` is their sum, so the printed figures always add up.
 */
export function grossUpAvailable(
    available: string,
    vatApplicable: boolean
): GrossedUpBalance {
    const net = new Decimal(available);
    const exclVat = net.div(new Decimal(1).minus(FRAK_FEE_RATE));
    const availableRounded = net.toDecimalPlaces(2);
    const frakFee = exclVat.minus(net).toDecimalPlaces(2);
    const vat = vatApplicable
        ? exclVat.mul(VAT_RATE).toDecimalPlaces(2)
        : new Decimal(0);
    return {
        gross: availableRounded.plus(frakFee).plus(vat).toFixed(2),
        vat: vat.toFixed(2),
        frakFee: frakFee.toFixed(2),
        available: availableRounded.toFixed(2),
    };
}
