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
        forceRefresh: Bool
    ) async throws -> EstimatedRewardsResult {
        let key = cacheKey(merchantId, currency: currency, targetInteraction: targetInteraction, audience: audience)

        if !forceRefresh, let entry = cache[key], now().timeIntervalSince(entry.fetchedAt) < Self.cacheTTL {
            return entry.result
        }

        if backoff.isBackingOff(key) {
            throw FrakError.network(underlying: Backoff.BackingOff(what: "reward fetch"))
        }

        return try await singleFlight.run(key) {
            try await self.request(
                key,
                merchantId: merchantId,
                currency: currency,
                targetInteraction: targetInteraction,
                audience: audience
            )
        }
    }

    private func request(
        _ key: String,
        merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?
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
                ]
            )
        } catch let error as FrakError {
            backoff.recordFailure(key, from: error)
            throw error
        }

        if !response.isSuccess {
            try backoff.recordFailureAndThrow(key, response.toServerError())
        }

        let result = try RewardsDecoder.decode(response.body)

        // This endpoint never 404s: an unknown merchantId returns 200 with an empty
        // list, indistinguishable from a merchant with no live campaigns.
        if result.campaigns.isEmpty {
            logger.debug("Frak: no active campaigns for merchant \(merchantId).")
        }

        backoff.recordSuccess(key)
        cache[key] = Entry(result: result, fetchedAt: now())
        return result
    }

    /// Every query parameter is in the key: `best` is selected server-side from the
    /// query, so two calls differing only in audience return genuinely different answers.
    private func cacheKey(
        _ merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?
    ) -> String {
        "\(merchantId):\(currency.rawValue):\(targetInteraction ?? ""):\(audience?.rawValue ?? "")"
    }
}
