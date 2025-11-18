# Backend API Route Testing Guide

This directory contains tests for Elysia API routes. The goal is to achieve better coverage by testing routes directly without building a full Elysia instance.

## Testing Approach

### Key Principles

1. **Test Exported Route Modules Directly**: Import and test the exported Elysia route instances (e.g., `socialRoute`, `commonRoutes`) instead of building a full app
2. **Mock Infrastructure Dependencies**: Use the existing mock infrastructure from `test/mock/` 
3. **Use Elysia's `.handle()` Method**: Call `.handle(new Request(...))` to simulate HTTP requests
4. **Co-locate Tests**: Place tests in `test/api/` mirroring the structure of `src/api/`

### Why This Approach?

- **Better Coverage**: Tests actual route logic, not just endpoint existence
- **Faster Tests**: No need to build full Elysia app with all middleware
- **Isolated Testing**: Each route can be tested independently
- **Easier Debugging**: Failures are isolated to specific routes
- **Reuses Existing Mocks**: Leverages the mock infrastructure already in place

## Test Structure

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import { routeModule } from "../../../src/api/path/to/route";
import { mockDependency } from "../../mock/common";

describe("Route Name API", () => {
    beforeEach(() => {
        // Reset mocks before each test
        mockDependency.method.mockClear();
    });

    describe("GET /endpoint", () => {
        it("should [expected behavior] when [condition]", async () => {
            // Arrange: Setup mocks
            mockDependency.method.mockResolvedValue(mockData);

            // Act: Make request
            const response = await routeModule.handle(
                new Request("http://localhost/endpoint?param=value")
            );

            // Assert: Verify response
            expect(response.status).toBe(200);
            expect(mockDependency.method).toHaveBeenCalledWith(expectedArgs);
            
            const data = await response.json();
            expect(data).toEqual(expectedData);
        });
    });
});
```

## Examples

### Simple Route (No Dependencies)

See `test/api/common/social.test.ts` for a route that doesn't require mocking:

```typescript
import { socialRoute } from "../../../src/api/common/social";

it("should redirect to URL when no user agent is present", async () => {
    const targetUrl = "https://example.com/page";
    const response = await socialRoute.handle(
        new Request(`http://localhost/social?u=${encodeURIComponent(targetUrl)}`)
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(targetUrl);
});
```

### Route with Mocked Dependencies

See `test/api/common/common.test.ts` for routes that use infrastructure:

```typescript
import { commonRoutes } from "../../../src/api/common/common";
import { pricingRepositoryMocks } from "../../mock/common";

beforeEach(() => {
    pricingRepositoryMocks.getTokenPrice.mockClear();
});

it("should return token price for valid address", async () => {
    const mockPrice = { usd: 1.5, eur: 1.3, gbp: 1.1 };
    pricingRepositoryMocks.getTokenPrice.mockResolvedValue(mockPrice);

    const response = await commonRoutes.handle(
        new Request("http://localhost/rate?token=0x1234567890123456789012345678901234567890")
    );

    expect(response.status).toBe(200);
    expect(pricingRepositoryMocks.getTokenPrice).toHaveBeenCalledWith({
        token: "0x1234567890123456789012345678901234567890",
    });

    const data = await response.json();
    expect(data).toEqual(mockPrice);
});
```

## Common Patterns

### Making Requests

```typescript
// GET request with query params
const response = await route.handle(
    new Request("http://localhost/path?param=value")
);

// POST request with JSON body
const response = await route.handle(
    new Request("http://localhost/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "value" }),
    })
);

// Request with custom headers
const response = await route.handle(
    new Request("http://localhost/path", {
        headers: {
            "user-agent": "Custom Agent",
            "authorization": "Bearer token",
        },
    })
);
```

### Checking Responses

```typescript
// Status codes
expect(response.status).toBe(200);
expect(response.status).toBe(422); // Elysia validation errors

// Headers
expect(response.headers.get("content-type")).toContain("application/json");
expect(response.headers.get("location")).toBe("https://example.com");

// JSON body
const data = await response.json();
expect(data).toEqual({ key: "value" });

// Text body
const text = await response.text();
expect(text).toBe("Error message");
```

### Mocking Dependencies

```typescript
// Mock successful response
mockRepository.method.mockResolvedValue(mockData);

// Mock error
mockRepository.method.mockRejectedValue(new Error("Database error"));

// Mock null/undefined
mockRepository.method.mockResolvedValue(null as never);

// Verify mock was called
expect(mockRepository.method).toHaveBeenCalledWith(expectedArgs);
expect(mockRepository.method).toHaveBeenCalledTimes(1);
expect(mockRepository.method).not.toHaveBeenCalled();
```

## Important Notes

### Elysia Validation Errors

Elysia returns **422 Unprocessable Entity** for validation errors, not 400:

```typescript
// ❌ Wrong
expect(response.status).toBe(400);

// ✅ Correct
expect(response.status).toBe(422); // For validation errors
expect(response.status).toBe(400); // For business logic errors (explicit status(400, ...))
```

### Mock Type Assertions

When mocking with `null` or non-standard values, use `as never`:

```typescript
mockRepository.method.mockResolvedValue(null as never);
mockRepository.method.mockResolvedValue(mockAccount as never);
```

### Available Mocks

See `test/mock/common.ts` for available mocks:

- `pricingRepositoryMocks` - Token pricing
- `adminWalletsRepositoryMocks` - Admin wallet accounts
- `dbMock` - Drizzle database operations
- `JwtContextMock` - JWT signing/verification
- `viemActionsMocks` - Blockchain interactions (from `test/mock/viem.ts`)
- `webPushMocks` - Push notifications

## Testing Checklist

For each route, test:

- ✅ **Happy path**: Valid inputs return expected response
- ✅ **Validation errors**: Invalid inputs return 422
- ✅ **Business logic errors**: Edge cases return appropriate status codes
- ✅ **Mock verification**: Dependencies are called with correct arguments
- ✅ **Error handling**: Errors from dependencies are handled gracefully
- ✅ **Edge cases**: Empty values, null, undefined, boundary conditions

## Running Tests

```bash
# Run all API tests
bun run test test/api/

# Run specific test file
bun run test test/api/common/social.test.ts

# Run with coverage
bun run test:coverage

# Watch mode
bun run test:watch test/api/
```

## Coverage Goals

- Target: 40% overall coverage (lines, functions, branches, statements)
- Focus on routes first (highest impact)
- Then repositories and services
- Infrastructure can have lower coverage (external dependencies)

## Next Steps

1. Add tests for all routes in `src/api/common/`
2. Add tests for `src/api/wallet/` routes
3. Add tests for `src/api/business/` routes
4. Add tests for `src/api/external/` routes
5. Refine mocks as needed for complex scenarios
