/**
 * Black-Scholes Probability Calculator
 * Calculates the probability of an option expiring in-the-money
 */

/**
 * Standard normal cumulative distribution function
 * Approximation using the error function
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

export interface ProbabilityParams {
  stockPrice: number;
  strikePrice: number;
  daysToExpiration: number;
  riskFreeRate?: number; // Default: 0.05 (5%)
  impliedVolatility: number;
  optionType: 'call' | 'put';
}

export interface ProbabilityResult {
  /**
   * Probability of expiring in-the-money (0-1)
   */
  probabilityITM: number;
  
  /**
   * Probability of expiring out-of-the-money (0-1)
   */
  probabilityOTM: number;
  
  /**
   * Delta-based probability approximation (0-1)
   */
  deltaApproximation?: number;
  
  /**
   * Black-Scholes d1 value
   */
  d1: number;
  
  /**
   * Black-Scholes d2 value
   */
  d2: number;
}

/**
 * Calculate probability using Black-Scholes model
 * 
 * The probability of an option expiring in-the-money is given by:
 * - For calls: N(d2)
 * - For puts: N(-d2)
 * 
 * Where d2 = (ln(S/K) + (r - σ²/2)T) / (σ√T)
 * 
 * @param params - Parameters for probability calculation
 * @returns Probability metrics
 */
export function calculateProbability(params: ProbabilityParams): ProbabilityResult {
  const {
    stockPrice: S,
    strikePrice: K,
    daysToExpiration,
    riskFreeRate = 0.05, // Default 5% annual risk-free rate
    impliedVolatility: sigma,
    optionType,
  } = params;

  // Convert days to years
  const T = daysToExpiration / 365;

  // Handle edge cases
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    return {
      probabilityITM: 0,
      probabilityOTM: 1,
      d1: 0,
      d2: 0,
    };
  }

  // Calculate d1 and d2
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (riskFreeRate + (sigma ** 2) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  // Calculate probabilities
  let probabilityITM: number;
  
  if (optionType === 'call') {
    // For calls: P(S_T > K) = N(d2)
    probabilityITM = normalCDF(d2);
  } else {
    // For puts: P(S_T < K) = N(-d2)
    probabilityITM = normalCDF(-d2);
  }

  const probabilityOTM = 1 - probabilityITM;

  return {
    probabilityITM,
    probabilityOTM,
    d1,
    d2,
  };
}

/**
 * Calculate probability using Delta approximation
 * Delta ≈ Probability of expiring ITM
 * 
 * This is a simpler but less accurate method
 */
export function calculateProbabilityFromDelta(
  delta: number,
  optionType: 'call' | 'put'
): number {
  // For calls: delta is already the probability
  // For puts: delta is negative, so we take absolute value
  return Math.abs(delta);
}

/**
 * Calculate probability of profit for a strategy
 * This considers the premium paid/received
 */
export interface ProfitProbabilityParams {
  stockPrice: number;
  breakEvenPrice: number;
  daysToExpiration: number;
  impliedVolatility: number;
  strategyType: 'long' | 'short'; // long = paid premium, short = received premium
  optionType: 'call' | 'put';
}

export function calculateProfitProbability(params: ProfitProbabilityParams): number {
  const {
    stockPrice,
    breakEvenPrice,
    daysToExpiration,
    impliedVolatility,
    strategyType,
    optionType,
  } = params;

  // For long strategies (paid premium), we need price to move beyond break-even
  // For short strategies (received premium), we need price to stay within break-even
  
  const probResult = calculateProbability({
    stockPrice,
    strikePrice: breakEvenPrice,
    daysToExpiration,
    impliedVolatility,
    optionType: strategyType === 'long' ? optionType : (optionType === 'call' ? 'put' : 'call'),
  });

  return strategyType === 'long' ? probResult.probabilityITM : probResult.probabilityOTM;
}
