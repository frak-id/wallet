{
    providers: {
        cliproxy: {
            name: "CLIProxyAPI (Frak)",
            baseUrl: $baseUrl,
            api: "anthropic-messages",
            apiKey: "$CLIPROXY_API_KEY",
            models: [
                {
                    id: "claude-sonnet-5",
                    name: "Claude Sonnet 5 (cliproxy)",
                    reasoning: true,
                    input: ["text"],
                    contextWindow: 200000,
                    maxTokens: 32000,
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
                },
                {
                    id: "claude-haiku-4-5",
                    name: "Claude Haiku 4.5 (cliproxy)",
                    reasoning: false,
                    input: ["text"],
                    contextWindow: 200000,
                    maxTokens: 16000,
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
                }
            ]
        }
    }
}
