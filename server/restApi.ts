import { Router } from "express";
import { getPolygonClient } from "./polygonClient";
import { calculateStrategyPL, generatePLCurve, OptionLeg } from "./strategyCalculator";

const router = Router();

/**
 * REST API endpoints for iOS app
 * These endpoints provide the same functionality as tRPC but in REST format
 */

// Get stock price
router.get("/stocks/:ticker/price", async (req, res) => {
  try {
    const { ticker } = req.params;
    const client = getPolygonClient();
    
    const price = await client.getStockPrice(ticker.toUpperCase());
    
    if (!price) {
      return res.status(404).json({ error: "Stock not found" });
    }
    
    res.json({
      ticker: ticker.toUpperCase(),
      price,
    });
  } catch (error: any) {
    console.error("Error fetching stock price:", error);
    res.status(500).json({ error: error.message || "Failed to fetch stock price" });
  }
});

// Search stocks
router.get("/stocks/search", async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query parameter is required" });
    }
    
    const client = getPolygonClient();
    const response = await client.searchTickers(query.toUpperCase());
    
    const results = (response.results || [])
      .filter((ticker) => ticker.active && ticker.market === "stocks")
      .slice(0, 10)
      .map((ticker) => ({
        symbol: ticker.ticker,
        name: ticker.name,
      }));
    
    res.json({ results });
  } catch (error: any) {
    console.error("Error searching stocks:", error);
    res.status(500).json({ error: error.message || "Failed to search stocks" });
  }
});

// Get expiration dates
router.get("/stocks/:ticker/options/expirations", async (req, res) => {
  try {
    const { ticker } = req.params;
    const { contractType = "call" } = req.query;
    
    const client = getPolygonClient();
    const response = await client.getOptionContracts({
      underlying_ticker: ticker.toUpperCase(),
      contract_type: contractType as 'call' | 'put',
      expired: false,
      limit: 1000,
    });
    
    const expirationDates = Array.from(
      new Set(
        (response.results || [])
          .map((contract) => contract.expiration_date)
          .filter(Boolean)
      )
    ).sort();
    
    res.json({ expirationDates });
  } catch (error: any) {
    console.error("Error fetching expiration dates:", error);
    res.status(500).json({ error: error.message || "Failed to fetch expiration dates" });
  }
});

// Get strike prices with Delta values
router.get("/stocks/:ticker/options/strikes", async (req, res) => {
  try {
    const { ticker } = req.params;
    const { expirationDate, contractType = "call" } = req.query;
    
    if (!expirationDate || typeof expirationDate !== "string") {
      return res.status(400).json({ error: "expirationDate parameter is required" });
    }
    
    const client = getPolygonClient();
    const snapshotResponse = await client.getOptionChainSnapshot({
      underlying_ticker: ticker.toUpperCase(),
      contract_type: contractType as 'call' | 'put',
      expiration_date: expirationDate,
      limit: 250,
    });
    
    const strikePrices = (snapshotResponse.results || [])
      .map((snapshot: any) => ({
        strikePrice: snapshot.details?.strike_price || 0,
        ticker: snapshot.details?.ticker || "",
        delta: snapshot.greeks?.delta || null,
      }))
      .filter((item) => item.strikePrice > 0)
      .sort((a, b) => a.strikePrice - b.strikePrice);
    
    res.json({ strikePrices });
  } catch (error: any) {
    console.error("Error fetching strike prices:", error);
    res.status(500).json({ error: error.message || "Failed to fetch strike prices" });
  }
});

// Get option quote
router.get("/options/quote", async (req, res) => {
  try {
    const { underlyingTicker, expirationDate, contractType, strikePrice } = req.query;
    
    if (!underlyingTicker || !expirationDate || !contractType || !strikePrice) {
      return res.status(400).json({ 
        error: "Missing required parameters: underlyingTicker, expirationDate, contractType, strikePrice" 
      });
    }
    
    const client = getPolygonClient();
    const snapshot = await client.getOptionChainSnapshot({
      underlying_ticker: underlyingTicker as string,
      contract_type: contractType as 'call' | 'put',
      expiration_date: expirationDate as string,
      strike_price: parseFloat(strikePrice as string),
      limit: 1,
    });
    
    if (!snapshot.results || snapshot.results.length === 0) {
      return res.json({
        found: false,
        bid: null,
        ask: null,
        last: null,
        midpoint: null,
        impliedVolatility: null,
        openInterest: null,
        greeks: null,
      });
    }
    
    const result = snapshot.results[0];
    const bid = result.day?.close || null;
    const ask = result.day?.close || null;
    const last = result.day?.close || null;
    const midpoint = last;
    
    res.json({
      found: true,
      bid,
      ask,
      last,
      midpoint,
      impliedVolatility: result.implied_volatility || null,
      openInterest: result.open_interest || null,
      greeks: result.greeks || null,
    });
  } catch (error: any) {
    console.error("Error fetching option quote:", error);
    res.status(500).json({ error: error.message || "Failed to fetch option quote" });
  }
});

// Calculate strategy P&L
router.post("/options/calculate", async (req, res) => {
  try {
    const { currentPrice, legs } = req.body;
    
    if (!currentPrice || !legs || !Array.isArray(legs)) {
      return res.status(400).json({ 
        error: "Missing required parameters: currentPrice, legs" 
      });
    }
    
    // Calculate P&L curve
    const curve = generatePLCurve(legs as OptionLeg[], currentPrice);
    
    // Calculate metrics
    const netCost = legs.reduce((sum: number, leg: any) => {
      const cost = leg.premium * leg.quantity * leg.sharesPerContract;
      return sum + (leg.position === 'long' ? cost : -cost);
    }, 0);
    
    // Find max profit and max loss from curve
    const profits = curve.map(p => p.profitLoss);
    const maxProfit = Math.max(...profits);
    const maxLoss = Math.min(...profits);
    
    // Find break-even points
    const breakEvenPoints: number[] = [];
    for (let i = 1; i < curve.length; i++) {
      const prev = curve[i - 1];
      const curr = curve[i];
      if ((prev.profitLoss < 0 && curr.profitLoss >= 0) || (prev.profitLoss >= 0 && curr.profitLoss < 0)) {
        // Linear interpolation to find exact break-even point
        const ratio = Math.abs(prev.profitLoss) / (Math.abs(prev.profitLoss) + Math.abs(curr.profitLoss));
        const breakEven = prev.stockPrice + ratio * (curr.stockPrice - prev.stockPrice);
        breakEvenPoints.push(parseFloat(breakEven.toFixed(2)));
      }
    }
    
    res.json({
      curve,
      metrics: {
        netCost,
        maxProfit: maxProfit === Infinity ? null : maxProfit,
        maxLoss: maxLoss === -Infinity ? null : maxLoss,
        breakEvenPoints,
      },
    });
  } catch (error: any) {
    console.error("Error calculating strategy:", error);
    res.status(500).json({ error: error.message || "Failed to calculate strategy" });
  }
});

export default router;
