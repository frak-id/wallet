export function setupBigIntSerialization(): void {
    // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
    if (typeof BigInt !== "undefined" && !(BigInt.prototype as any).toJSON) {
        // biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype doesn't have toJSON in type definition
        (BigInt.prototype as any).toJSON = function () {
            return this.toString();
        };
    }
}
