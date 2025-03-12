import { describe, expect, test, vi } from "vitest";
import { Deferred } from "./Deferred";

describe("Deferred", () => {
    test("should create a deferred promise", () => {
        const deferred = new Deferred<string>();
        expect(deferred.promise).toBeInstanceOf(Promise);
    });

    test("should resolve the promise with the provided value", async () => {
        const deferred = new Deferred<string>();
        const expectedValue = "resolved value";

        deferred.resolve(expectedValue);

        const result = await deferred.promise;
        expect(result).toBe(expectedValue);
    });

    test("should reject the promise with the provided reason", async () => {
        const deferred = new Deferred<string>();
        const expectedError = new Error("test error");

        deferred.reject(expectedError);

        await expect(deferred.promise).rejects.toBe(expectedError);
    });

    test("should allow resolving with a promise", async () => {
        const deferred = new Deferred<string>();
        const promiseValue = Promise.resolve("resolved from promise");

        deferred.resolve(promiseValue);

        const result = await deferred.promise;
        expect(result).toBe("resolved from promise");
    });

    test("should ignore subsequent resolve calls after first resolution", async () => {
        const deferred = new Deferred<string>();
        const spy = vi.fn();

        deferred.promise.then(spy);

        deferred.resolve("first");
        deferred.resolve("second");

        await deferred.promise;
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith("first");
    });

    test("should ignore subsequent reject calls after first resolution", async () => {
        const deferred = new Deferred<string>();
        const spy = vi.fn();
        const errorSpy = vi.fn();

        deferred.promise.then(spy, errorSpy);

        deferred.resolve("success");
        deferred.reject(new Error("error"));

        await deferred.promise;
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith("success");
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test("should ignore subsequent resolve calls after first rejection", async () => {
        const deferred = new Deferred<string>();
        const spy = vi.fn();
        const errorSpy = vi.fn();

        deferred.promise.then(spy, errorSpy);

        const error = new Error("error");
        deferred.reject(error);
        deferred.resolve("success");

        await expect(deferred.promise).rejects.toThrow();
        expect(spy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(error);
    });

    test("should handle undefined rejection reason", async () => {
        const deferred = new Deferred<string>();

        deferred.reject(undefined);

        await expect(deferred.promise).rejects.toBeUndefined();
    });
});
