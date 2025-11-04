export type {}; // This line makes the file an external module

declare global {
    interface BigInt {
        toJSON(): string;
    }
}

if (typeof BigInt !== "undefined" && BigInt.prototype.toJSON === undefined) {
    BigInt.prototype.toJSON = function (): string {
        return this.toString();
    };
}
