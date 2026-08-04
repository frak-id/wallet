import Foundation

/// Entry point. Call `initialize(_:)` once, then use `client`.
///
/// ```swift
/// Frak.initialize(FrakConfig(merchantId: "...", metadata: FrakMetadata(name: "Acme")))
///
/// let reward = try await Frak.client.rewards.best(targetInteraction: "purchase")
/// ```
public enum Frak {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var core: DefaultFrakClient?
    nonisolated(unsafe) private static var instance: FrakClient?
    // Kept alongside the client so preloadSharing can be read without widening FrakClient.
    nonisolated(unsafe) private static var configuration: FrakConfig?

    // Non-blocking, no I/O, never throws. Second call is a no-op (first config wins).
    public static func initialize(_ config: FrakConfig) {
        let logger = FrakLogger(level: config.logLevel, sink: config.logSink)
        let effective = config.withBundleIdFromMainBundle()
        let missingIdentity = effective.merchantId == nil && effective.bundleId == nil

        // Logging must not happen while `lock` is held (a sink reading Frak.client would
        // deadlock); the switch below emits every log line after the lock is released.
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

            guard let store = UserDefaultsStore(),
                let identityStore = UserDefaultsStore(suiteName: UserDefaultsStore.identitySuiteName)
            else {
                return .missingStore
            }

            // ONE instance, shared by the client and the identity store. Two would memoise the
            // persisted decision independently and drift the moment setTrackingEnabled is called.
            // It lives in the identity suite, not the disposable config cache.
            let consent = TrackingConsent(
                store: identityStore,
                configDefault: effective.trackingEnabled,
                logger: logger
            )
            let newCore = DefaultFrakClient(
                settings: effective,
                store: store,
                identity: AnonymousIdStore(
                    keyStore: PersistedDeviceKeyStore(store: identityStore),
                    store: identityStore,
                    logger: logger,
                    // App scope == merchant scope; regenerated if this ever changes.
                    merchantMarker: effective.merchantId ?? effective.bundleId ?? "",
                    consent: consent
                ),
                consent: consent,
                queue: EventQueue(fileURL: EventQueue.defaultFileURL(logger: logger), logger: logger),
                launcher: SystemAppLauncher(),
                logger: logger
            )
            core = newCore
            instance = FrakClient(core: newCore)
            configuration = effective
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
            if let reason = effective.env.customOriginRejectionReason {
                logger.error("FrakEnvironment.custom: \(reason) Requests will fail with FrakError.network.")
            }
            logger.info("Frak \(FrakSDKVersion.current) initialized.")
        }
    }

    public static var client: FrakClient {
        get throws {
            lock.lock()
            defer { lock.unlock() }
            guard let instance else { throw FrakError.notInitialized }
            return instance
        }
    }

    /// Same as `client`, but nil instead of throwing (A6): for a call site that would just
    /// `try?` it anyway. `client` itself already composes with `try?`; this exists for parity
    /// with the Android surface, and for a call site that reads better without `try?`.
    public static var clientOrNull: FrakClient? {
        lock.lock()
        defer { lock.unlock() }
        return instance
    }

    // Pure/static: works before initialize(_:) has run. Decode-only — arrival tracking
    // and the self-referral guard are FrakClient.appLink.handleReferral(_:).
    public static func parseReferralLink(_ url: String) -> FrakContext? {
        SharingLinkBuilder.parse(url)
    }

    public static func parseReferralLink(_ url: URL) -> FrakContext? {
        SharingLinkBuilder.parse(url.absoluteString)
    }

    // Mirrors FrakConfig.preloadSharing for FrakSDKUI. Lives here (not FrakClient) so
    // :frak-sdk-ui can read one flag without widening the client's public surface.
    public static var preloadSharing: Bool {
        lock.lock()
        defer { lock.unlock() }
        return configuration?.preloadSharing ?? false
    }

    public static var isInitialized: Bool {
        lock.lock()
        defer { lock.unlock() }
        return instance != nil
    }

    /// Tears the SDK down: cancels the background work it owns and drops the client so
    /// `initialize(_:)` can run again with a different `FrakConfig`.
    ///
    /// S6b/C7. **Not a privacy control** — use `FrakClient.setTrackingEnabled(_:)` for that;
    /// shutting the SDK down neither records a consent decision nor erases anything, so a merchant
    /// who calls only this has stopped tracking for exactly as long as their process lives. This
    /// exists so a host can deterministically release the SDK, and so the facade is testable at
    /// all (T2/8.8).
    ///
    /// Idempotent and safe before `initialize(_:)`.
    public static func shutdown() async {
        // Read and cleared under the lock, acted on outside it: this is an async function and the
        // lock must never span a suspension point.
        let dying: DefaultFrakClient?
        lock.lock()
        dying = core
        core = nil
        instance = nil
        configuration = nil
        lock.unlock()
        await dying?.shutdown()
    }

    /// Synchronous teardown for tests that cannot await. Drops the singletons WITHOUT cancelling
    /// the client's background work — prefer `shutdown()`, which does both.
    static func resetForTesting() {
        lock.lock()
        defer { lock.unlock() }
        core = nil
        instance = nil
        configuration = nil
    }
}

extension FrakConfig {
    fileprivate func withBundleIdFromMainBundle() -> FrakConfig {
        guard merchantId == nil, bundleId == nil, let bundleId = Bundle.main.bundleIdentifier else {
            return self
        }
        return withBundleId(bundleId)
    }
}
