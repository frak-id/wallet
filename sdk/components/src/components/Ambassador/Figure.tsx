import { amountUnit, amountWords } from "./Ambassador.css";

const FIGURE = /^(\D*?)(\d[\d\s.,\u00A0\u202F]*?)(\D*)$/;

/** Draws the currency of a formatted amount smaller; wording without a figure passes through. */
export function Figure({ amount }: { amount: string }) {
    const parts = FIGURE.exec(amount);
    if (!parts) {
        return (
            <span class={`${amountWords} frak-ambassador__amount-words`}>
                {amount}
            </span>
        );
    }
    const [, before, figure, after] = parts;
    const unit = (text: string) =>
        text ? (
            <small class={`${amountUnit} frak-ambassador__amount-unit`}>
                {text}
            </small>
        ) : null;
    return (
        <>
            {unit(before)}
            {figure}
            {unit(after)}
        </>
    );
}
