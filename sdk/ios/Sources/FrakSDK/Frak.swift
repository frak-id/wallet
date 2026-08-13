import Foundation

/// Entry point. Call `initialize(_:)` once, then use `client`.
///
/// ```swift
/// Frak.initialize(FrakConfig(merchantId: "...", metadata: FrakMetadata(name: "Acme")))
///
/// let reward = try await Frak.client.rewards.best(RewardRequest(targetInteraction: "purchase"))
/// ```
public enum Frak {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var core: DefaultFrakClient?
    nonisolated(unsafe) private static var instance: FrakClient?

    // Never throws, and the only I/O is preparing the SDK's storage directory, which is memoised.
    // Second call is a no-op; the first configuration wins.
    public static func initialize(_ config: FrakConfig) {
        let logger = FrakLogger(level: config.logLevel, sink: config.logSink)
        let effective = config.withBundleIdFromMainBundle()
        let missingIdentity = effective.merchantId == nil && effective.bundleId == nil

        // Logging must not happen while `lock` is held (a sink reading Frak.client would
        // deadlock); the switch below emits every log line after the lock is released.
        enum Outcome {
            case alreadyInitialized
            case missingStore
            case missingIdentityStore
            case initialized
        }

        let outcome: Outcome = {
            lock.lock()
            defer { lock.unlock() }

            if instance != nil {
                return .alreadyInitialized
            }

            guard let store = UserDefaultsStore(),
                let consentStore = UserDefaultsStore(suiteName: UserDefaultsStore.consentSuiteName)
            else {
                return .missingStore
            }
            // Key material and the marker guarding it go to a backup-excluded file, never a
            // UserDefaults suite: a suite plist is carried to a restored device, which would
            // clone this installation's identity onto it.
            guard let identityStore = FileKeyValueStore.makeDefault(logger: logger) else {
                return .missingIdentityStore
            }

            // One instance, shared by the client and the identity store: two would memoise the
            // persisted decision independently and drift the moment setTrackingEnabled is called.
            // The consent suite, not the disposable config cache, and not the identity file: a
            // withdrawal is the one persisted value that must survive a restore.
            let consent = TrackingConsent(
                store: consentStore,
                configDefault: effective.trackingEnabled,
                logger: logger
            )
            let newCore = DefaultFrakClient(
                settings: effective,
                store: store,
                identity: AnonymousIdStore(
                    keyStore: PersistedDeviceKeyStore(store: identityStore, logger: logger),
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
        case .missingIdentityStore:
            // Refuses rather than falling back to a location that is backed up or purgeable:
            // the first would clone this identity onto a restored device, the second would
            // report every purge as a brand-new user.
            logger.error(
                "Frak could not prepare its identity storage under Application Support. "
                    + "The SDK will not initialize."
            )
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

    /// Same as `client`, but nil instead of throwing: for a call site that would just `try?`
    /// it anyway. Exists for parity with the Android surface, and for a call site that reads
    /// better without `try?`.
    public static var clientOrNull: FrakClient? {
        lock.lock()
        defer { lock.unlock() }
        return instance
    }

    // Pure/static: works before initialize(_:) has run. Decode-only — arrival tracking
    // and the self-referral guard live in FrakClient.appLink.handleReferral(_:).
    public static func parseReferralLink(_ url: String) -> FrakContext? {
        SharingLinkBuilder.parse(url)
    }

    public static func parseReferralLink(_ url: URL) -> FrakContext? {
        SharingLinkBuilder.parse(url.absoluteString)
    }

    public static var isInitialized: Bool {
        lock.lock()
        defer { lock.unlock() }
        return instance != nil
    }

    /// Tears the SDK down: cancels the background work it owns and drops the client so
    /// `initialize(_:)` can run again with a different `FrakConfig`.
    ///
    /// Not a privacy control — use `FrakClient.setTrackingEnabled(_:)` for that; shutting the
    /// SDK down neither records a consent decision nor erases anything, so a merchant who calls
    /// only this has stopped tracking for exactly as long as their process lives. Exists so a
    /// host can deterministically release the SDK, and so the facade is testable at all.
    ///
    /// Idempotent and safe before `initialize(_:)`.
    public static func shutdown() async {
        await takeForShutdown()?.shutdown()
    }

    /// Clears every singleton and hands back the client that was live, for `shutdown()` to await
    /// outside the lock.
    ///
    /// A separate synchronous function rather than a `lock()`/`unlock()` pair inside
    /// `shutdown()` itself: `NSLock.lock()`/`unlock()` are unavailable from an async context
    /// under Swift 6 strict concurrency, so the inline version failed the simulator build.
    /// Hoisting the critical section out also makes the "lock never spans a suspension point"
    /// rule structural: there is no `await` this function could reach.
    private static func takeForShutdown() -> DefaultFrakClient? {
        lock.lock()
        defer { lock.unlock() }
        let dying = core
        core = nil
        instance = nil
        return dying
    }

    /// Synchronous teardown for tests that cannot await. Drops the singletons WITHOUT cancelling
    /// the client's background work — prefer `shutdown()`, which does both.
    static func resetForTesting() {
        lock.lock()
        defer { lock.unlock() }
        core = nil
        instance = nil
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
