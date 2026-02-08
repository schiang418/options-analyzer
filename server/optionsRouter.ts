import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getPolygonClient } from "./polygonClient";
import {
  calculateLongCall,
  calculateLongPut,
  calculateShortCall,
  calculateShortPut,
  calculateBullPutSpread,
  calculateBearCallSpread,
  calculateProfitProbability,
  generatePLCurve,
  calculateStrategyPL,
  type OptionLeg,
} from "./strategyCalculator";
import {
  createSavedStrategy,
  getUserSavedStrategies,
  deleteSavedStrategy,
  createAnalysisHistory,
  getUserAnalysisHistory,
  getUserPreferences,
  upsertUserPreferences,
} from "./db";

/**
 * Options-related tRPC procedures
 */
export const optionsRouter = router({
  // Search for stock tickers (autocomplete)
  searchTickers: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const client = getPolygonClient();
      const response = await client.searchTickers(input.query, input.limit);
      
      return {
        tickers: response.results?.map((ticker: any) => ({
          symbol: ticker.ticker,
          name: ticker.name,
          market: ticker.market,
          locale: ticker.locale,
          type: ticker.type,
        })) || [],
      };
    }),

  // Get current stock price
  getStockPrice: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      const client = getPolygonClient();
      const price = await client.getStockPrice(input.ticker);
      
      return { ticker: input.ticker, price };
    }),

  // Get available expiration dates for a ticker
  getExpirationDates: publicProcedure
    .input(
      z.object({
        underlyingTicker: z.string(),
        contractType: z.enum(["call", "put"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const client = getPolygonClient();
      const response = await client.getOptionContracts({
        underlying_ticker: input.underlyingTicker,
        contract_type: input.contractType,
        expired: false,
        limit: 1000,
      });
      
      // Extract unique expiration dates and sort them
      const expirationDates = Array.from(
        new Set(response.results?.map((contract) => contract.expiration_date) || [])
      ).sort();
      
      return { expirationDates };
    }),

  // Get available strike prices for a specific expiration date
  getStrikePrices: publicProcedure
    .input(
      z.object({
        underlyingTicker: z.string(),
        expirationDate: z.string(),
        contractType: z.enum(["call", "put"]),
      })
    )
    .query(async ({ input }) => {
      const client = getPolygonClient();
      const response = await client.getOptionContracts({
        underlying_ticker: input.underlyingTicker,
        expiration_date: input.expirationDate,
        contract_type: input.contractType,
        expired: false,
        limit: 1000,
      });
      
      // Extract strike prices and sort them
      const strikePrices = (response.results || [])
        .map((contract) => ({
          strikePrice: contract.strike_price,
          ticker: contract.ticker,
        }))
        .sort((a, b) => a.strikePrice - b.strikePrice);
      
      return { strikePrices };
    }),

  // Get option quote (premium) for a specific contract
  getOptionQuote: publicProcedure
    .input(
      z.object({
        underlyingTicker: z.string(),
        expirationDate: z.string(),
        contractType: z.enum(["call", "put"]),
        strikePrice: z.number(),
      })
    )
    .query(async ({ input }) => {
      const client = getPolygonClient();
      
      // Get option chain snapshot to find the specific contract
      const response = await client.getOptionChainSnapshot({
        underlying_ticker: input.underlyingTicker,
        contract_type: input.contractType,
        expiration_date: input.expirationDate,
        strike_price: input.strikePrice,
        limit: 1,
      });
      
      const snapshot = response.results?.[0];
      if (!snapshot) {
        return { 
          found: false,
          bid: null,
          ask: null,
          last: null,
          midpoint: null,
        };
      }
      
      return {
        found: true,
        bid: snapshot.last_quote?.bid || null,
        ask: snapshot.last_quote?.ask || null,
        last: snapshot.last_trade?.price || null,
        midpoint: snapshot.last_quote?.midpoint || null,
        impliedVolatility: snapshot.implied_volatility || null,
        openInterest: snapshot.open_interest || null,
        greeks: snapshot.greeks || null,
      };
    }),

  // Get option contracts for a ticker
  getOptionContracts: publicProcedure
    .input(
      z.object({
        underlyingTicker: z.string(),
        contractType: z.enum(["call", "put"]).optional(),
        expirationDate: z.string().optional(),
        strikePrice: z.number().optional(),
        limit: z.number().min(1).max(250).default(100),
      })
    )
    .query(async ({ input }) => {
      const client = getPolygonClient();
      const response = await client.getOptionContracts({
        underlying_ticker: input.underlyingTicker,
        contract_type: input.contractType,
        expiration_date: input.expirationDate,
        strike_price: input.strikePrice,
        limit: input.limit,
        order: "asc",
        sort: "strike_price",
      });
      
      return {
        contracts: response.results || [],
        nextUrl: response.next_url,
      };
    }),

  // Get option chain snapshot with pricing and greeks
  getOptionChain: publicProcedure
    .input(
      z.object({
        underlyingTicker: z.string(),
        contractType: z.enum(["call", "put"]).optional(),
        expirationDate: z.string().optional(),
        limit: z.number().min(1).max(250).default(100),
      })
    )
    .query(async ({ input }) => {
      const client = getPolygonClient();
      const response = await client.getOptionChainSnapshot({
        underlying_ticker: input.underlyingTicker,
        contract_type: input.contractType,
        expiration_date: input.expirationDate,
        limit: input.limit,
        order: "asc",
        sort: "strike_price",
      });
      
      return {
        options: response.results || [],
        nextUrl: response.next_url,
      };
    }),

  // Calculate strategy metrics
  calculateStrategy: publicProcedure
    .input(
      z.object({
        strategyType: z.enum([
          "long_call",
          "long_put",
          "short_call",
          "short_put",
          "bull_put_spread",
          "bear_call_spread",
        ]),
        currentPrice: z.number(),
        // Single leg strategies
        strikePrice: z.number().optional(),
        premium: z.number().optional(),
        quantity: z.number().default(1),
        // Spread strategies
        shortStrike: z.number().optional(),
        shortPremium: z.number().optional(),
        longStrike: z.number().optional(),
        longPremium: z.number().optional(),
        // For probability calculation
        impliedVolatility: z.number().optional(),
        daysToExpiration: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      let metrics;
      
      switch (input.strategyType) {
        case "long_call":
          metrics = calculateLongCall(
            input.strikePrice!,
            input.premium!,
            input.quantity,
            input.currentPrice
          );
          break;
        case "long_put":
          metrics = calculateLongPut(
            input.strikePrice!,
            input.premium!,
            input.quantity,
            input.currentPrice
          );
          break;
        case "short_call":
          metrics = calculateShortCall(
            input.strikePrice!,
            input.premium!,
            input.quantity,
            input.currentPrice
          );
          break;
        case "short_put":
          metrics = calculateShortPut(
            input.strikePrice!,
            input.premium!,
            input.quantity,
            input.currentPrice
          );
          break;
        case "bull_put_spread":
          metrics = calculateBullPutSpread(
            input.shortStrike!,
            input.shortPremium!,
            input.longStrike!,
            input.longPremium!,
            input.quantity,
            input.currentPrice
          );
          break;
        case "bear_call_spread":
          metrics = calculateBearCallSpread(
            input.shortStrike!,
            input.shortPremium!,
            input.longStrike!,
            input.longPremium!,
            input.quantity,
            input.currentPrice
          );
          break;
        default:
          throw new Error("Invalid strategy type");
      }
      
      // Calculate profit probability if IV and days provided
      if (input.impliedVolatility && input.daysToExpiration && metrics.breakEvenPoints.length > 0) {
        metrics.profitProbability = calculateProfitProbability(
          input.currentPrice,
          metrics.breakEvenPoints[0],
          input.impliedVolatility,
          input.daysToExpiration
        );
      }
      
      return metrics;
    }),

  // Generate P&L curve data
  generatePLCurve: publicProcedure
    .input(
      z.object({
        legs: z.array(
          z.object({
            type: z.enum(["call", "put"]),
            position: z.enum(["long", "short"]),
            strikePrice: z.number(),
            premium: z.number(),
            quantity: z.number(),
            sharesPerContract: z.number().default(100),
          })
        ),
        currentPrice: z.number(),
        range: z.number().default(0.5),
      })
    )
    .query(async ({ input }) => {
      const curve = generatePLCurve(input.legs as OptionLeg[], input.currentPrice, input.range);
      return { curve };
    }),

  // Save strategy (protected)
  saveStrategy: protectedProcedure
    .input(
      z.object({
        strategyName: z.string().min(1).max(100),
        strategyType: z.enum([
          "long_call",
          "long_put",
          "short_call",
          "short_put",
          "bull_put_spread",
          "bear_call_spread",
        ]),
        underlyingTicker: z.string(),
        underlyingPrice: z.string(),
        strategyConfig: z.any(),
        maxProfit: z.string().optional(),
        maxLoss: z.string().optional(),
        breakEvenPrice: z.string().optional(),
        profitProbability: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const strategy = await createSavedStrategy({
        userId: ctx.user.id,
        ...input,
      });
      
      return { success: true, strategy };
    }),

  // Get user's saved strategies
  getSavedStrategies: protectedProcedure.query(async ({ ctx }) => {
    const strategies = await getUserSavedStrategies(ctx.user.id);
    return { strategies };
  }),

  // Delete saved strategy
  deleteStrategy: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await deleteSavedStrategy(input.id, ctx.user.id);
      return { success };
    }),

  // Save analysis to history
  saveAnalysis: protectedProcedure
    .input(
      z.object({
        underlyingTicker: z.string(),
        strategyType: z.enum([
          "long_call",
          "long_put",
          "short_call",
          "short_put",
          "bull_put_spread",
          "bear_call_spread",
        ]),
        analysisSnapshot: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const history = await createAnalysisHistory({
        userId: ctx.user.id,
        ...input,
      });
      
      return { success: true, history };
    }),

  // Get user's analysis history
  getAnalysisHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const history = await getUserAnalysisHistory(ctx.user.id, input.limit);
      return { history };
    }),

  // Get user preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const preferences = await getUserPreferences(ctx.user.id);
    return { preferences };
  }),

  // Update user preferences
  updatePreferences: protectedProcedure
    .input(
      z.object({
        defaultStrategy: z
          .enum([
            "long_call",
            "long_put",
            "short_call",
            "short_put",
            "bull_put_spread",
            "bear_call_spread",
          ])
          .optional(),
        favoriteTickers: z.array(z.string()).optional(),
        chartTheme: z.enum(["light", "dark"]).optional(),
        showGreeks: z.number().optional(),
        showProbability: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const preferences = await upsertUserPreferences({
        userId: ctx.user.id,
        ...input,
      });
      
      return { success: true, preferences };
    }),
});
