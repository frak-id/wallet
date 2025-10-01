/**
 * Generic RPC Schema Types
 *
 * This module defines the shape and structure of RPC schemas without any
 * domain-specific types. Consumers (like @frak-labs/core-sdk) provide their
 * own concrete schema types that conform to these generic structures.
 *
 * @module rpc-schema
 */

import type { Prettify } from "viem";

/**
 * Generic shape of a single RPC schema entry
 *
 * Each entry defines a method with its parameters, return type, and response kind
 *
 * @typeParam TMethod - The method name (string literal)
 * @typeParam TParams - The parameters type (can be undefined for no parameters)
 * @typeParam TReturn - The return type
 * @typeParam TResponseKind - Either "promise" or "stream"
 */
export type RpcSchemaEntry<
    TMethod extends string = string,
    TParams = unknown,
    TReturn = unknown,
> = {
    /**
     * The method name (e.g., "frak_sendInteraction")
     */
    Method: TMethod;
    /**
     * The parameters type (undefined if no parameters)
     */
    Parameters?: TParams;
    /**
     * The return type
     */
    ReturnType: TReturn;
};

/**
 * An RPC schema is a readonly array of schema entries
 *
 * @example
 * ```ts
 * type MySchema = [
 *   {
 *     Method: "greet";
 *     Parameters: [name: string];
 *     ReturnType: string;
 *     ResponseType: "promise";
 *   },
 *   {
 *     Method: "watchTime";
 *     Parameters?: undefined;
 *     ReturnType: number;
 *     ResponseType: "stream";
 *   }
 * ]
 * ```
 */
export type RpcSchema = readonly RpcSchemaEntry[];

/**
 * Extract method names from a schema
 *
 * @typeParam TSchema - The RPC schema type
 *
 * @example
 * ```ts
 * type Methods = ExtractMethod<MySchema>
 * // "greet" | "watchTime"
 * ```
 */
export type ExtractMethod<TSchema extends RpcSchema> =
    TSchema[number]["Method"];

/**
 * Extract a specific schema entry by method name
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TMethod - The method name to extract
 *
 * @example
 * ```ts
 * type GreetEntry = ExtractSchemaEntry<MySchema, "greet">
 * // { Method: "greet"; Parameters: [name: string]; ReturnType: string; ResponseType: "promise" }
 * ```
 */
export type ExtractSchemaEntry<
    TSchema extends RpcSchema,
    TMethod extends ExtractMethod<TSchema>,
> = Extract<TSchema[number], { Method: TMethod }>;

/**
 * Extract parameters type for a specific method
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TMethod - The method name
 *
 * @example
 * ```ts
 * type GreetParams = ExtractParams<MySchema, "greet">
 * // [name: string]
 * ```
 */
export type ExtractParams<
    TSchema extends RpcSchema,
    TMethod extends ExtractMethod<TSchema>,
> = ExtractSchemaEntry<TSchema, TMethod>["Parameters"];

/**
 * Type that extract the possible parameters from a RPC Schema
 * @ignore
 */
export type ExtractedParametersFromRpc<TRpcSchema extends RpcSchema> = {
    [K in keyof TRpcSchema]: Prettify<
        {
            method: TRpcSchema[K] extends TRpcSchema[number]
                ? TRpcSchema[K]["Method"]
                : string;
        } & (TRpcSchema[K] extends TRpcSchema[number]
            ? TRpcSchema[K]["Parameters"] extends undefined
                ? { params?: never }
                : { params: TRpcSchema[K]["Parameters"] }
            : never)
    >;
}[number];

/**
 * Type that extract the possible parameters from a RPC Schema
 * @ignore
 */
export type ExtractedSpecificParametersFromRpc<
    TRpcSchema extends RpcSchema,
    TMethod extends ExtractMethod<TRpcSchema>,
> = Extract<ExtractedParametersFromRpc<TRpcSchema>, { method: TMethod }>;

/**
 * Extract return type for a specific method
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TMethod - The method name
 *
 * @example
 * ```ts
 * type GreetReturn = ExtractReturnType<MySchema, "greet">
 * // string
 * ```
 */
export type ExtractReturnType<
    TSchema extends RpcSchema,
    TMethod extends ExtractMethod<TSchema>,
> = ExtractSchemaEntry<TSchema, TMethod>["ReturnType"];
