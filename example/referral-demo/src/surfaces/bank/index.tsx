import { HeliaMark } from "./HeliaMark";

export { BankApp } from "./BankApp";

/** The bank's app icon, filling a 38px iOS notification icon slot. */
export function BankAppIcon() {
    return <HeliaMark size={38} tile={true} />;
}
