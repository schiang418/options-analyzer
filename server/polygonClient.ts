import axios, { AxiosInstance } from 'axios';

/**
 * Polygon.io (Massive) API Client
 * Wrapper for accessing options market data from Polygon.io
 */

const POLYGON_BASE_URL = 'https://api.polygon.io';

interface PolygonConfig {
  apiKey: string;
  baseURL?: string;
}

export interface OptionContract {
  ticker: string;
  underlying_ticker: string;
  contract_type: 'call' | 'put';
  strike_price: number;
  expiration_date: string;
  exercise_style: 'american' | 'european' | 'bermudan';
  shares_per_contract: number;
  primary_exchange?: string;
  cfi?: string;
}

export interface OptionSnapshot {
  break_even_price: number;
  day?: {
    change: number;
    change_percent: number;
    close: number;
    high: number;
    low: number;
    open: number;
    previous_close: number;
    volume: number;
    vwap: number;
    last_updated: number;
  };
  details: {
    contract_type: 'call' | 'put';
    exercise_style: string;
    expiration_date: string;
    shares_per_contract: number;
    strike_price: number;
    ticker: string;
  };
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  implied_volatility?: number;
  last_quote?: {
    ask: number;
    ask_size: number;
    bid: number;
    bid_size: number;
    midpoint: number;
    last_updated: number;
    timeframe: string;
  };
  last_trade?: {
    price: number;
    size: number;
    exchange: number;
    sip_timestamp: number;
    conditions?: number[];
    timeframe: string;
  };
  open_interest: number;
  underlying_asset: {
    price: number;
    ticker: string;
    change_to_break_even?: number;
    last_updated: number;
    timeframe?: string;
  };
}

export interface PolygonResponse<T> {
  status: string;
  request_id?: string;
  results?: T;
  next_url?: string;
  count?: number;
}

class PolygonClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: PolygonConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: config.baseURL || POLYGON_BASE_URL,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Get all option contracts for an underlying ticker
   */
  async getOptionContracts(params: {
    underlying_ticker: string;
    contract_type?: 'call' | 'put';
    expiration_date?: string;
    strike_price?: number;
    expired?: boolean;
    limit?: number;
    order?: 'asc' | 'desc';
    sort?: string;
  }): Promise<PolygonResponse<OptionContract[]>> {
    const response = await this.client.get('/v3/reference/options/contracts', {
      params: {
        ...params,
        apiKey: this.apiKey,
      },
    });
    return response.data;
  }

  /**
   * Get option chain snapshot for an underlying ticker
   * Returns all options contracts with current pricing, greeks, and market data
   */
  async getOptionChainSnapshot(params: {
    underlying_ticker: string;
    contract_type?: 'call' | 'put';
    expiration_date?: string;
    strike_price?: number;
    limit?: number;
    order?: 'asc' | 'desc';
    sort?: string;
  }): Promise<PolygonResponse<OptionSnapshot[]>> {
    const { underlying_ticker, ...queryParams } = params;
    const response = await this.client.get(`/v3/snapshot/options/${underlying_ticker}`, {
      params: {
        ...queryParams,
        apiKey: this.apiKey,
      },
    });
    return response.data;
  }

  /**
   * Get a single option contract snapshot
   */
  async getOptionContractSnapshot(optionTicker: string): Promise<PolygonResponse<OptionSnapshot>> {
    const response = await this.client.get(`/v3/snapshot/options/${optionTicker}`, {
      params: {
        apiKey: this.apiKey,
      },
    });
    return response.data;
  }

  /**
   * Search for stock tickers (for autocomplete)
   */
  async searchTickers(query: string, limit: number = 10): Promise<PolygonResponse<any[]>> {
    const response = await this.client.get('/v3/reference/tickers', {
      params: {
        search: query,
        market: 'stocks',
        active: true,
        limit,
        apiKey: this.apiKey,
      },
    });
    return response.data;
  }

  /**
   * Get current stock price
   */
  async getStockPrice(ticker: string): Promise<number | null> {
    try {
      const response = await this.client.get(`/v2/aggs/ticker/${ticker}/prev`, {
        params: {
          apiKey: this.apiKey,
        },
      });
      
      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0].c; // closing price
      }
      return null;
    } catch (error) {
      console.error('Error fetching stock price:', error);
      return null;
    }
  }

  /**
   * Test API connection and key validity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/v3/reference/tickers', {
        params: {
          limit: 1,
          apiKey: this.apiKey,
        },
      });
      return response.data.status === 'OK';
    } catch (error) {
      console.error('Polygon API connection test failed:', error);
      return false;
    }
  }
}

// Singleton instance
let polygonClientInstance: PolygonClient | null = null;

export function getPolygonClient(): PolygonClient {
  if (!polygonClientInstance) {
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      throw new Error('POLYGON_API_KEY environment variable is not set');
    }
    polygonClientInstance = new PolygonClient({ apiKey });
  }
  return polygonClientInstance;
}

export default PolygonClient;
