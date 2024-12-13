/**
 * The received encoded data from a client
 *  -> The encoded should contain a HashProtectedData once decoded
 *  @ignore
 */
export type CompressedData = Readonly<{
    compressed: string;
    compressedHash: string;
}>;

/**
 * The encoded data to send to a client / received by a client
 *  @ignore
 */
export type HashProtectedData<DataType> = Readonly<
    DataType & {
        validationHash: string;
    }
>;

/**
 * Represent a key provider used for the hashed and secure compression
 *  @ignore
 */
export type KeyProvider<DataType> = (value: DataType) => string[];
