import { beforeEach, describe, expect, it, vi } from "vitest";

// Import the route AFTER setting up the mock (mocked in vitest-setup.ts)
import { airtableRoutes } from "../../../src/api/common/airtable";

// The airtableRoutes instance has a decorator "airtableRepository" which is a mock instance
// We'll access it using type assertions to get around Elysia's type complexity
const getMockRepository = () => {
    const instance = airtableRoutes as any;
    // Elysia stores decorators in instance.decorator
    return instance.decorator.airtableRepository as {
        processRequest: ReturnType<typeof vi.fn>;
        checkDuplicateEmail: ReturnType<typeof vi.fn>;
        createRecord: ReturnType<typeof vi.fn>;
        sendSlackNotification: ReturnType<typeof vi.fn>;
    };
};

describe("Airtable Route API", () => {
    beforeEach(() => {
        // Clear all mock calls
        vi.clearAllMocks();
    });

    describe("POST /airtable", () => {
        it("should process valid demo_request table submission when all fields are provided", async () => {
            const mockRepository = getMockRepository();
            const mockResult = {
                recordId: "rec123",
                message: "Record created successfully in demo_request table",
            };
            mockRepository.processRequest.mockResolvedValue(mockResult);

            const requestBody = {
                lastName: "Doe",
                firstName: "John",
                company: "Acme Corp",
                phone: "+1234567890",
                email: "john.doe@example.com",
                url: "https://example.com",
                position: "CEO",
                country: "US",
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=demo_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            expect(response.status).toBe(200);
            expect(mockRepository.processRequest).toHaveBeenCalledWith(
                "demo_request",
                requestBody
            );

            const data = await response.json();
            expect(data).toEqual({ success: true });
        });

        it("should process valid simulation table submission when all fields are provided", async () => {
            const mockRepository = getMockRepository();
            const mockResult = {
                recordId: "rec456",
                message: "Record created successfully in simulation table",
            };
            mockRepository.processRequest.mockResolvedValue(mockResult);

            const requestBody = {
                lastName: "Smith",
                firstName: "Jane",
                company: "Tech Inc",
                phone: "+9876543210",
                email: "jane.smith@example.com",
                url: "https://tech.example.com",
                visits: 1000,
                channels: ["twitter", "facebook"],
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=simulation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            expect(response.status).toBe(200);
            expect(mockRepository.processRequest).toHaveBeenCalledWith(
                "simulation",
                requestBody
            );

            const data = await response.json();
            expect(data).toEqual({ success: true });
        });

        it("should process demo_request submission without optional url field", async () => {
            const mockRepository = getMockRepository();
            const mockResult = {
                recordId: "rec789",
                message: "Record created successfully in demo_request table",
            };
            mockRepository.processRequest.mockResolvedValue(mockResult);

            const requestBody = {
                lastName: "Brown",
                firstName: "Charlie",
                company: "StartUp Co",
                phone: "+1111111111",
                email: "charlie@startup.com",
                position: "CTO",
                country: "UK",
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=demo_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            expect(response.status).toBe(200);
            expect(mockRepository.processRequest).toHaveBeenCalledWith(
                "demo_request",
                requestBody
            );
        });

        it("should process simulation submission without optional url field", async () => {
            const mockRepository = getMockRepository();
            const mockResult = {
                recordId: "rec999",
                message: "Record created successfully in simulation table",
            };
            mockRepository.processRequest.mockResolvedValue(mockResult);

            const requestBody = {
                lastName: "Wilson",
                firstName: "Alice",
                company: "Digital Corp",
                phone: "+2222222222",
                email: "alice@digital.com",
                visits: 5000,
                channels: ["instagram"],
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=simulation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            expect(response.status).toBe(200);
            expect(mockRepository.processRequest).toHaveBeenCalledWith(
                "simulation",
                requestBody
            );
        });

        it("should return 422 when table query parameter is missing", async () => {
            const mockRepository = getMockRepository();
            const requestBody = {
                lastName: "Doe",
                firstName: "John",
                company: "Acme Corp",
                phone: "+1234567890",
                email: "john.doe@example.com",
                position: "CEO",
                country: "US",
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            // Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
            expect(mockRepository.processRequest).not.toHaveBeenCalled();
        });

        it("should return 400 when table parameter has invalid value", async () => {
            const mockRepository = getMockRepository();
            const requestBody = {
                lastName: "Doe",
                firstName: "John",
                company: "Acme Corp",
                phone: "+1234567890",
                email: "john.doe@example.com",
                position: "CEO",
                country: "US",
            };

            const response = await airtableRoutes.handle(
                new Request(
                    "http://localhost/airtable?table=invalid_table_name",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(requestBody),
                    }
                )
            );

            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            expect(errorMessage).toBe(
                "table must be either 'demo_request' or 'simulation'"
            );
            expect(mockRepository.processRequest).not.toHaveBeenCalled();
        });

        it("should return 422 when email is missing in request body", async () => {
            const mockRepository = getMockRepository();
            const requestBody = {
                lastName: "Doe",
                firstName: "John",
                company: "Acme Corp",
                phone: "+1234567890",
                position: "CEO",
                country: "US",
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=demo_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            // Elysia returns 422 for validation errors (schema validation)
            expect(response.status).toBe(422);
            expect(mockRepository.processRequest).not.toHaveBeenCalled();
        });

        it("should return 422 when request body is missing required fields", async () => {
            const mockRepository = getMockRepository();
            const requestBody = {
                email: "test@example.com",
                // Missing other required fields
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=demo_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            // Elysia returns 422 for validation errors
            expect(response.status).toBe(422);
            expect(mockRepository.processRequest).not.toHaveBeenCalled();
        });

        it("should return 409 when repository throws 'already exists' error", async () => {
            const mockRepository = getMockRepository();
            mockRepository.processRequest.mockRejectedValue(
                new Error("Record with this email already exists")
            );

            const requestBody = {
                lastName: "Doe",
                firstName: "John",
                company: "Acme Corp",
                phone: "+1234567890",
                email: "existing@example.com",
                position: "CEO",
                country: "US",
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=demo_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            expect(response.status).toBe(409);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Record with this email already exists");
            expect(mockRepository.processRequest).toHaveBeenCalledWith(
                "demo_request",
                requestBody
            );
        });

        it("should return 500 when repository throws generic error", async () => {
            const mockRepository = getMockRepository();
            const genericError = new Error("Database connection failed");
            mockRepository.processRequest.mockRejectedValue(genericError);

            const requestBody = {
                lastName: "Doe",
                firstName: "John",
                company: "Acme Corp",
                phone: "+1234567890",
                email: "john.doe@example.com",
                position: "CEO",
                country: "US",
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=demo_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            expect(response.status).toBe(500);
            const errorMessage = await response.text();
            expect(errorMessage).toBe(
                "Failed to process request: Database connection failed"
            );
            expect(mockRepository.processRequest).toHaveBeenCalledWith(
                "demo_request",
                requestBody
            );
        });

        it("should return 500 when repository throws non-Error object", async () => {
            const mockRepository = getMockRepository();
            mockRepository.processRequest.mockRejectedValue("String error");

            const requestBody = {
                lastName: "Doe",
                firstName: "John",
                company: "Acme Corp",
                phone: "+1234567890",
                email: "john.doe@example.com",
                position: "CEO",
                country: "US",
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=demo_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            expect(response.status).toBe(500);
            const errorMessage = await response.text();
            expect(errorMessage).toBe(
                "Failed to process request: String error"
            );
        });

        it("should detect 'already exists' error with lowercase check", async () => {
            const mockRepository = getMockRepository();
            mockRepository.processRequest.mockRejectedValue(
                new Error("Email already exists in database")
            );

            const requestBody = {
                lastName: "Doe",
                firstName: "John",
                company: "Acme Corp",
                phone: "+1234567890",
                email: "duplicate@example.com",
                position: "CEO",
                country: "US",
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=demo_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            expect(response.status).toBe(409);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Email already exists in database");
        });

        it("should handle empty table query parameter", async () => {
            const mockRepository = getMockRepository();
            const requestBody = {
                lastName: "Doe",
                firstName: "John",
                company: "Acme Corp",
                phone: "+1234567890",
                email: "john.doe@example.com",
                position: "CEO",
                country: "US",
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            expect(response.status).toBe(400);
            const errorMessage = await response.text();
            // Empty string triggers the "is required" check first
            expect(errorMessage).toContain("table");
            expect(mockRepository.processRequest).not.toHaveBeenCalled();
        });

        it("should validate simulation table with correct schema (visits and channels)", async () => {
            const mockRepository = getMockRepository();
            const mockResult = {
                recordId: "recSim123",
                message: "Record created successfully in simulation table",
            };
            mockRepository.processRequest.mockResolvedValue(mockResult);

            const requestBody = {
                lastName: "Test",
                firstName: "User",
                company: "Test Company",
                phone: "+1234567890",
                email: "test@example.com",
                visits: 250,
                channels: ["email", "social", "search"],
            };

            const response = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=simulation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                })
            );

            expect(response.status).toBe(200);
            expect(mockRepository.processRequest).toHaveBeenCalledWith(
                "simulation",
                requestBody
            );
        });

        it("should accept either union type schema variant", async () => {
            const mockRepository = getMockRepository();
            // Union types in Elysia accept either variant, so this test verifies
            // that the validation accepts valid data from either schema
            const mockResult = {
                recordId: "recUnion1",
                message: "Record created successfully",
            };
            mockRepository.processRequest.mockResolvedValue(mockResult);

            // Test with demo_request schema
            const demoRequestBody = {
                lastName: "Test",
                firstName: "User",
                company: "Test Company",
                phone: "+1234567890",
                email: "test1@example.com",
                position: "CEO",
                country: "US",
            };

            const response1 = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=demo_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(demoRequestBody),
                })
            );

            expect(response1.status).toBe(200);

            // Test with simulation schema
            const simulationBody = {
                lastName: "Test",
                firstName: "User",
                company: "Test Company",
                phone: "+1234567890",
                email: "test2@example.com",
                visits: 100,
                channels: ["email"],
            };

            const response2 = await airtableRoutes.handle(
                new Request("http://localhost/airtable?table=simulation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(simulationBody),
                })
            );

            expect(response2.status).toBe(200);
        });
    });
});
