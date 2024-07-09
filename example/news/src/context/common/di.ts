type ServiceIdentifier = string;
type ServiceGetter<T> = () => T | Promise<T>;
type ServiceEntry<T> = {
    getter: ServiceGetter<T>;
    instance?: T;
};

type ConditionalServiceGetter<
    Return,
    Getter extends ServiceGetter<Return> = ServiceGetter<Return>,
> = ReturnType<Getter> extends Promise<Return>
    ? () => Promise<Return>
    : () => Return;

/**
 * Our service register
 */
const registry = new Map<ServiceIdentifier, ServiceEntry<unknown>>();

/**
 * Function to register a new service
 */
const register = <T>(id: ServiceIdentifier, getter: ServiceGetter<T>) => {
    if (registry.has(id)) {
        throw new Error(`Service ${id} already registered.`);
    }

    registry.set(id, { getter });
};

/**
 * Register a new dependency in our DI Container and return a direct getter
 * @param p
 */
function registerAndExposeGetter<ValueType>(p: {
    id: ServiceIdentifier;
    getter: () => ValueType;
    isAsync?: false;
}): () => ValueType;

/**
 * Register a new dependency in our DI Container and return an async getter
 * @param p
 */
function registerAndExposeGetter<ValueType>(p: {
    id: ServiceIdentifier;
    getter: () => Promise<ValueType>;
    isAsync: true;
}): () => Promise<ValueType>;

/**
 * Register a new dependency in our DI Container
 * @param id
 * @param getter
 * @param isAsync
 */
function registerAndExposeGetter<
    ValueType,
    BuilderType extends ServiceGetter<ValueType> = ServiceGetter<ValueType>,
    GetterType extends ConditionalServiceGetter<
        ValueType,
        BuilderType
    > = ConditionalServiceGetter<ValueType, BuilderType>,
>({
    id,
    getter,
    isAsync,
}: {
    id: ServiceIdentifier;
    getter: ServiceGetter<ValueType>;
    isAsync?: boolean;
}): ConditionalServiceGetter<ValueType, BuilderType> {
    register(id, getter);
    return (
        isAsync ? () => getAsync<ValueType>(id) : () => get<ValueType>(id)
    ) as GetterType;
}

/**
 * Get a dependency from our DI Container
 * @param id
 */
async function getAsync<T>(id: ServiceIdentifier): Promise<T> {
    const entry = registry.get(id);

    // If we don't have an instance, and no getter, throw
    if (!entry) {
        throw new Error("Service not found.");
    }

    let { instance } = entry;

    // If we don't have an instance yet, try to build it
    if (!instance) {
        instance = await entry.getter();
        registry.set(id, { getter: entry.getter, instance });
    }
    return instance as T;
}

/**
 * Get a dependency from our DI Container
 * @param id
 */
function get<T>(id: ServiceIdentifier): T {
    const entry = registry.get(id);

    // If we don't have an instance, and no getter, throw
    if (!entry) {
        throw new Error("Service not found.");
    }

    let { instance } = entry;

    // If we don't have an instance yet, try to build it
    if (!instance) {
        instance = entry.getter();
        if (instance instanceof Promise) {
            throw new Error(
                "Service needs to be built asynchronously. Use getAsync to build and get the service."
            );
        }
        registry.set(id, { getter: entry.getter, instance });
    }

    return instance as T;
}

/**
 * Our DI Container
 */
export const DI = {
    registerAndExposeGetter,
};
