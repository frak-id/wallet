import Foundation

/// Entry point. Call `initialize(_:)` once, then use `client`.
///
/// ```swift
/// Frak.initialize(FrakConfig(merchantId: "...", metadata: FrakMetadata(name: "Acme")))
///
/// let reward = try await Frak.client.bestReward(targetInteraction: "purchase")
/// ```
///
/// A namespace rather than an instance the merchant holds — a native app maps to
/// exactly one merchant.
public enum Frak {
    private static let lock = NSLock()
    // Guarded by `lock`, not by the compiler: every access below takes it first.
    nonisolated(unsafe) private static var instance: (any FrakClient)?

    /// Starts the SDK. Non-blocking, does no I/O, and never throws.
    ///
    /// A second call is a no-op and logs a warning; the first configuration wins.
    public static func initialize(_ config: FrakConfig) {
        let logger = FrakLogger(level: config.logLevel, sink: config.logSink)
        let effective = config.withBundleIdFromMainBundle()
        let missingIdentity = effective.merchantId == nil && effective.bundleId == nil

        // Nothing below may call out to merchant code (the logger) while `lock` is held:
        // a sink that reads `Frak.isInitialized` or `Frak.client` would deadlock against
        // itself on the calling thread. The critical section only decides what happened;
        // every log line it implies is emitted from the switch below, after the lock is
        // released.
        enum Outcome {
            case alreadyInitialized
            case missingStore
            case initialized
        }

        let outcome: Outcome = {
            lock.lock()
            defer { lock.unlock() }

            if instance != nil {
                return .alreadyInitialized
            }

            guard let store = UserDefaultsStore() else {
                return .missingStore
            }

            instance = DefaultFrakClient(config: effective, store: store, logger: logger)
            return .initialized
        }()

        switch outcome {
        case .alreadyInitialized:
            logger.warn("Frak.initialize was called more than once. The first configuration is kept.")
        case .missingStore:
            if missingIdentity {
                logger.error(
                    "FrakConfig has neither a merchantId nor a bundleId. "
                        + "Every SDK call will fail with merchantResolutionFailed."
                )
            }
            logger.error("Frak could not open its UserDefaults suite. The SDK will not initialize.")
        case .initialized:
            if missingIdentity {
                logger.error(
                    "FrakConfig has neither a merchantId nor a bundleId. "
                        + "Every SDK call will fail with merchantResolutionFailed."
                )
            }
            logger.info("Frak \(FrakSDKVersion.current) initialized.")
        }
    }

    /// The client.
    ///
    /// - Throws: `FrakError.notInitialized` when `initialize(_:)` has not run.
    public static var client: any FrakClient {
        get throws {
            lock.lock()
            defer { lock.unlock() }
            guard let instance else { throw FrakError.notInitialized }
            return instance
        }
    }

    /// Whether `initialize(_:)` has run. For merchants guarding optional integrations.
    public static var isInitialized: Bool {
        lock.lock()
        defer { lock.unlock() }
        return instance != nil
    }

    /// Drops the client, for tests.
    static func resetForTesting() {
        lock.lock()
        defer { lock.unlock() }
        instance = nil
    }
}

extension FrakConfig {
    /// Fills in `bundleId` from `Bundle.main` when the merchant left both nil.
    fileprivate func withBundleIdFromMainBundle() -> FrakConfig {
        guard merchantId == nil, bundleId == nil, let bundleId = Bundle.main.bundleIdentifier else {
            return self
        }
        return withBundleId(bundleId)
    }
}
