/**
 * Options Strategy Calculator
 * Calculates key metrics for various options strategies
 */

export type StrategyType = 
  | 'long_call'
  | 'long_put'
  | 'short_call'
  | 'short_put'
  | 'bull_put_spread'
  | 'bear_call_spread';

export interface OptionLeg {
  type: 'call' | 'put';
  position: 'long' | 'short'; // long = buy, short = sell
  strikePrice: number;
  premium: number; // price per share
  quantity: number; // number of contracts
  sharesPerContract: number; // typically 100
}

export interface StrategyMetrics {
  netCost: number; // negative for credit, positive for debit
  maxProfit: number;
  maxLoss: number;
  breakEvenPoints: number[];
  profitProbability?: number; // based on implied volatility
  returnOnRisk?: number; // (max profit / max loss) * 100
}

export interface ProfitLossPoint {
  stockPrice: number;
  profitLoss: number;
}

/**
 * Calculate profit/loss for a single option leg at expiration
 */
function calculateLegPL(leg: OptionLeg, stockPrice: number): number {
  const { type, position, strikePrice, premium, quantity, sharesPerContract } = leg;
  const totalShares = quantity * sharesPerContract;
  
  let intrinsicValue = 0;
  
  if (type === 'call') {
    intrinsicValue = Math.max(0, stockPrice - strikePrice);
  } else {
    intrinsicValue = Math.max(0, strikePrice - stockPrice);
  }
  
  if (position === 'long') {
    // Bought option: pay premium, receive intrinsic value
    return (intrinsicValue - premium) * totalShares;
  } else {
    // Sold option: receive premium, pay intrinsic value
    return (premium - intrinsicValue) * totalShares;
  }
}

/**
 * Calculate profit/loss for entire strategy at a given stock price
 */
export function calculateStrategyPL(legs: OptionLeg[], stockPrice: number): number {
  return legs.reduce((total, leg) => total + calculateLegPL(leg, stockPrice), 0);
}

/**
 * Generate profit/loss curve data points
 */
export function generatePLCurve(
  legs: OptionLeg[],
  currentPrice: number,
  range: number = 0.5 // +/- 50% of current price
): ProfitLossPoint[] {
  const minPrice = currentPrice * (1 - range);
  const maxPrice = currentPrice * (1 + range);
  const step = (maxPrice - minPrice) / 100; // 100 data points
  
  const points: ProfitLossPoint[] = [];
  
  for (let price = minPrice; price <= maxPrice; price += step) {
    points.push({
      stockPrice: Math.round(price * 100) / 100,
      profitLoss: Math.round(calculateStrategyPL(legs, price) * 100) / 100,
    });
  }
  
  return points;
}

/**
 * Calculate break-even points for a strategy
 */
function findBreakEvenPoints(legs: OptionLeg[], currentPrice: number): number[] {
  const minPrice = currentPrice * 0.5;
  const maxPrice = currentPrice * 1.5;
  const step = 0.01; // $0.01 increments
  
  const breakEvenPoints: number[] = [];
  let previousPL = calculateStrategyPL(legs, minPrice);
  
  for (let price = minPrice + step; price <= maxPrice; price += step) {
    const currentPL = calculateStrategyPL(legs, price);
    
    // Check if sign changed (crossed zero)
    if ((previousPL < 0 && currentPL >= 0) || (previousPL > 0 && currentPL <= 0)) {
      breakEvenPoints.push(Math.round(price * 100) / 100);
    }
    
    previousPL = currentPL;
  }
  
  return breakEvenPoints;
}

/**
 * Calculate Long Call strategy metrics
 */
export function calculateLongCall(
  strikePrice: number,
  premium: number,
  quantity: number = 1,
  currentPrice: number
): StrategyMetrics {
  const legs: OptionLeg[] = [{
    type: 'call',
    position: 'long',
    strikePrice,
    premium,
    quantity,
    sharesPerContract: 100,
  }];
  
  const netCost = premium * quantity * 100; // debit
  const maxLoss = netCost;
  const maxProfit = Infinity; // unlimited upside
  const breakEvenPoints = [strikePrice + premium];
  
  return {
    netCost,
    maxProfit,
    maxLoss,
    breakEvenPoints,
  };
}

/**
 * Calculate Long Put strategy metrics
 */
export function calculateLongPut(
  strikePrice: number,
  premium: number,
  quantity: number = 1,
  currentPrice: number
): StrategyMetrics {
  const legs: OptionLeg[] = [{
    type: 'put',
    position: 'long',
    strikePrice,
    premium,
    quantity,
    sharesPerContract: 100,
  }];
  
  const netCost = premium * quantity * 100; // debit
  const maxLoss = netCost;
  const maxProfit = (strikePrice - premium) * quantity * 100; // limited to strike price
  const breakEvenPoints = [strikePrice - premium];
  
  return {
    netCost,
    maxProfit,
    maxLoss,
    breakEvenPoints,
  };
}

/**
 * Calculate Short Call strategy metrics
 */
export function calculateShortCall(
  strikePrice: number,
  premium: number,
  quantity: number = 1,
  currentPrice: number
): StrategyMetrics {
  const legs: OptionLeg[] = [{
    type: 'call',
    position: 'short',
    strikePrice,
    premium,
    quantity,
    sharesPerContract: 100,
  }];
  
  const netCost = -premium * quantity * 100; // credit (negative cost)
  const maxProfit = premium * quantity * 100;
  const maxLoss = Infinity; // unlimited downside
  const breakEvenPoints = [strikePrice + premium];
  
  return {
    netCost,
    maxProfit,
    maxLoss,
    breakEvenPoints,
  };
}

/**
 * Calculate Short Put strategy metrics
 */
export function calculateShortPut(
  strikePrice: number,
  premium: number,
  quantity: number = 1,
  currentPrice: number
): StrategyMetrics {
  const legs: OptionLeg[] = [{
    type: 'put',
    position: 'short',
    strikePrice,
    premium,
    quantity,
    sharesPerContract: 100,
  }];
  
  const netCost = -premium * quantity * 100; // credit (negative cost)
  const maxProfit = premium * quantity * 100;
  const maxLoss = (strikePrice - premium) * quantity * 100;
  const breakEvenPoints = [strikePrice - premium];
  
  return {
    netCost,
    maxProfit,
    maxLoss,
    breakEvenPoints,
  };
}

/**
 * Calculate Bull Put Spread strategy metrics
 * Sell higher strike put + Buy lower strike put (credit spread)
 * Bullish strategy: profit if stock stays above short put strike
 */
export function calculateBullPutSpread(
  shortPutStrike: number, // higher strike (sell)
  shortPutPremium: number,
  longPutStrike: number, // lower strike (buy)
  longPutPremium: number,
  quantity: number = 1,
  currentPrice: number
): StrategyMetrics {
  const legs: OptionLeg[] = [
    {
      type: 'put',
      position: 'short',
      strikePrice: shortPutStrike,
      premium: shortPutPremium,
      quantity,
      sharesPerContract: 100,
    },
    {
      type: 'put',
      position: 'long',
      strikePrice: longPutStrike,
      premium: longPutPremium,
      quantity,
      sharesPerContract: 100,
    },
  ];
  
  const netCredit = (shortPutPremium - longPutPremium) * quantity * 100;
  const maxProfit = netCredit;
  const maxLoss = (shortPutStrike - longPutStrike) * quantity * 100 - netCredit;
  const breakEvenPoints = [shortPutStrike - (shortPutPremium - longPutPremium)];
  const returnOnRisk = (maxProfit / Math.abs(maxLoss)) * 100;
  
  return {
    netCost: -netCredit, // negative because it's a credit
    maxProfit,
    maxLoss,
    breakEvenPoints,
    returnOnRisk,
  };
}

/**
 * Calculate Bear Call Spread strategy metrics
 * Sell lower strike call + Buy higher strike call (credit spread)
 * Bearish strategy: profit if stock stays below short call strike
 */
export function calculateBearCallSpread(
  shortCallStrike: number, // lower strike (sell)
  shortCallPremium: number,
  longCallStrike: number, // higher strike (buy)
  longCallPremium: number,
  quantity: number = 1,
  currentPrice: number
): StrategyMetrics {
  const legs: OptionLeg[] = [
    {
      type: 'call',
      position: 'short',
      strikePrice: shortCallStrike,
      premium: shortCallPremium,
      quantity,
      sharesPerContract: 100,
    },
    {
      type: 'call',
      position: 'long',
      strikePrice: longCallStrike,
      premium: longCallPremium,
      quantity,
      sharesPerContract: 100,
    },
  ];
  
  const netCredit = (shortCallPremium - longCallPremium) * quantity * 100;
  const maxProfit = netCredit;
  const maxLoss = (longCallStrike - shortCallStrike) * quantity * 100 - netCredit;
  const breakEvenPoints = [shortCallStrike + (shortCallPremium - longCallPremium)];
  const returnOnRisk = (maxProfit / Math.abs(maxLoss)) * 100;
  
  return {
    netCost: -netCredit, // negative because it's a credit
    maxProfit,
    maxLoss,
    breakEvenPoints,
    returnOnRisk,
  };
}

/**
 * Calculate probability of profit based on implied volatility
 * Uses simplified Black-Scholes approximation
 */
export function calculateProfitProbability(
  currentPrice: number,
  breakEvenPrice: number,
  impliedVolatility: number, // as decimal (e.g., 0.25 for 25%)
  daysToExpiration: number
): number {
  if (impliedVolatility <= 0 || daysToExpiration <= 0) {
    return 50; // default to 50% if no valid IV data
  }
  
  const timeToExpiration = daysToExpiration / 365;
  const drift = 0; // assume no drift for simplicity
  const volatility = impliedVolatility * Math.sqrt(timeToExpiration);
  
  // Calculate z-score
  const logReturn = Math.log(breakEvenPrice / currentPrice);
  const zScore = (logReturn - drift) / volatility;
  
  // Convert to probability using standard normal CDF approximation
  const probability = standardNormalCDF(-zScore) * 100;
  
  return Math.round(probability * 100) / 100;
}

/**
 * Standard normal cumulative distribution function (CDF)
 * Approximation using error function
 */
function standardNormalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  return x > 0 ? 1 - probability : probability;
}
