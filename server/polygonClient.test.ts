import { describe, expect, it } from "vitest";
import { getPolygonClient } from "./polygonClient";

describe("Polygon API Client", () => {
  it("should successfully connect to Polygon API with valid key", async () => {
    const client = getPolygonClient();
    const isConnected = await client.testConnection();
    
    expect(isConnected).toBe(true);
  }, 15000); // 15 second timeout for API call

  it("should fetch stock tickers for search", async () => {
    const client = getPolygonClient();
    const response = await client.searchTickers("AAPL", 5);
    
    expect(response.status).toBe("OK");
    expect(response.results).toBeDefined();
    expect(Array.isArray(response.results)).toBe(true);
  }, 15000);
});
