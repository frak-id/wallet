import Foundation

/// Reads `GET /user/merchant/estimated-rewards`, with a 30s cache and no
/// stale-while-revalidate: unlike config, an expired entry is dropped rather than
/// served, because a stale reward figure is money shown to a user.
actor RewardRepository {
    static let rewardsPath = "/user/merchant/estimated-rewards"
    static let cacheTTL: TimeInterval = 30
    private static let formatted = "1"

    private struct Entry {
        let result: EstimatedRewardsResult
        let fetchedAt: Date
    }

    private let http: HTTPClient
    private let logger: FrakLogger
    private let now: @Sendable () -> Date

    private var singleFlight = SingleFlight<EstimatedRewardsResult>()
    private var backoff = Backoff()
    private var cache: [String: Entry] = [:]

    /// Test-only window onto the cache's size. The products string makes the key space
    /// caller-controlled, so "the map stays bounded" is a property worth asserting rather
    /// than trusting.
    var cachedEntryCount: Int { cache.count }

    init(http: HTTPClient, logger: FrakLogger, now: @escaping @Sendable () -> Date = { Date() }) {
        self.http = http
        self.logger = logger
        self.now = now
    }

    /// Fetches the campaigns and the server-selected best reward, from the 30s cache
    /// when usable.
    func fetch(
        merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?,
        products: [ProductDetails]?,
        forceRefresh: Bool
    ) async throws -> EstimatedRewardsResult {
        // The encoded string, not a hash of it, is the discriminator: two otherwise-identical
        // fetches with different products must not share a cache entry, and the string is
        // already a compact, stable representation.
        let encodedProducts = ProductDetailsQueryEncoder.encode(products ?? [], logger: logger)
        let key = cacheKey(
            merchantId,
            currency: currency,
            targetInteraction: targetInteraction,
            audience: audience,
            encodedProducts: encodedProducts
        )
        // Deliberately products-free: backoff is a statement about the backend's health, not
        // one product set. Folding products in would mint a fresh key with a zero failure count
        // on every product page, so a failing backend would be re-dialled instead of backed off.
        let backoffKey = cacheKey(
            merchantId,
            currency: currency,
            targetInteraction: targetInteraction,
            audience: audience,
            encodedProducts: nil
        )

        if !forceRefresh, let entry = cache[key], now().timeIntervalSince(entry.fetchedAt) < Self.cacheTTL {
            return entry.result
        }

        if let retryAfter = backoff.remaining(backoffKey) {
            throw FrakError.backingOff(retryAfterSeconds: retryAfter)
        }

        return try await singleFlight.run(key) {
            try await self.request(
                key,
                backoffKey: backoffKey,
                merchantId: merchantId,
                currency: currency,
                targetInteraction: targetInteraction,
                audience: audience,
                encodedProducts: encodedProducts
            )
        }
    }

    private func request(
        _ key: String,
        backoffKey: String,
        merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?,
        encodedProducts: String?
    ) async throws -> EstimatedRewardsResult {
        let response: HTTPClient.Response
        do {
            response = try await http.get(
                Self.rewardsPath,
                query: [
                    "merchantId": merchantId,
                    // Literal string "1": the backend declares this as a literal, not a
                    // boolean; omitting it drops `best` entirely, which looks like "no rewards".
                    "formatted": Self.formatted,
                    "currency": currency.rawValue,
                    "targetInteraction": targetInteraction,
                    "audience": audience?.rawValue,
                    "products": encodedProducts,
                ]
            )
        } catch let error as FrakError {
            backoff.recordFailure(backoffKey, from: error)
            throw error
        }

        if !response.isSuccess {
            try backoff.recordFailureAndThrow(backoffKey, response.toServerError())
        }

        let result = try RewardsDecoder.decode(response.body)

        // This endpoint never 404s: an unknown merchantId returns 200 with an empty
        // list, indistinguishable from a merchant with no live campaigns.
        if result.campaigns.isEmpty {
            logger.debug("Frak: no active campaigns for merchant \(merchantId).")
        }

        backoff.recordSuccess(backoffKey)
        // Sweep before inserting: `products` puts a caller-controlled, up-to-4KB string in the
        // key, so the map is no longer bounded by the handful of merchant/currency/audience
        // combinations it used to hold. Dropping expired entries here bounds the map to what
        // was actually asked for inside one TTL window.
        let cutoff = now().addingTimeInterval(-Self.cacheTTL)
        cache = cache.filter { $0.value.fetchedAt > cutoff }
        cache[key] = Entry(result: result, fetchedAt: now())
        return result
    }

    /// Every query parameter is in the key: `best` is selected server-side from the query, so
    /// two calls differing only in audience or products return genuinely different answers.
    private func cacheKey(
        _ merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?,
        encodedProducts: String?
    ) -> String {
        "\(merchantId):\(currency.rawValue):\(targetInteraction ?? ""):\(audience?.rawValue ?? ""):\(encodedProducts ?? "")"
    }
}
