/**
 * Simple deferred promise wrapper
 * @ignore
 */
export class Deferred<T> {
    private readonly _promise: Promise<T>;
    private _resolve: ((value: T | PromiseLike<T>) => void) | undefined;
    private _reject: ((reason?: unknown) => void) | undefined;

    constructor() {
        this._promise = new Promise<T>((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    get promise(): Promise<T> {
        return this._promise;
    }

    resolve = (value: T | PromiseLike<T>): void => {
        this._resolve?.(value);
    };

    reject = (reason?: unknown): void => {
        this._reject?.(reason);
    };
}
