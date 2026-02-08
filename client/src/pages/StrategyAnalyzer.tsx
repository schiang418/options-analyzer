import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Target, Percent } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

type StrategyType = "long_call" | "long_put" | "short_call" | "short_put" | "bull_put_spread" | "bear_call_spread";

const STRATEGY_OPTIONS = [
  { value: "long_call", label: "Long Call", description: "Buy call option - bullish" },
  { value: "long_put", label: "Long Put", description: "Buy put option - bearish" },
  { value: "short_call", label: "Short Call", description: "Sell call option - bearish/neutral" },
  { value: "short_put", label: "Short Put", description: "Sell put option - bullish/neutral" },
  { value: "bull_put_spread", label: "Bull Put Spread", description: "Credit spread - bullish" },
  { value: "bear_call_spread", label: "Bear Call Spread", description: "Credit spread - bearish" },
];

export default function StrategyAnalyzer() {
  const [ticker, setTicker] = useState("");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [strategyType, setStrategyType] = useState<StrategyType>("long_call");
  
  // Expiration date
  const [expirationDate, setExpirationDate] = useState("");
  
  // Single leg parameters
  const [strikePrice, setStrikePrice] = useState("");
  const [premium, setPremium] = useState("");
  
  // Spread parameters
  const [shortStrike, setShortStrike] = useState("");
  const [shortPremium, setShortPremium] = useState("");
  const [longStrike, setLongStrike] = useState("");
  const [longPremium, setLongPremium] = useState("");
  
  const [quantity, setQuantity] = useState("1");
  const [shouldCalculate, setShouldCalculate] = useState(false);

  // Calculate strategy type
  const isSpread = strategyType === "bull_put_spread" || strategyType === "bear_call_spread";

  // Search tickers
  const { data: tickerResults, isLoading: searchingTickers } = trpc.options.searchTickers.useQuery(
    { query: ticker, limit: 10 },
    { enabled: ticker.length >= 2 }
  );

  // Get stock price
  const { data: stockData, isLoading: loadingPrice } = trpc.options.getStockPrice.useQuery(
    { ticker: selectedTicker },
    { enabled: !!selectedTicker }
  );

  // Get expiration dates
  const contractType = strategyType.includes("call") ? "call" as const : "put" as const;
  const { data: expirationData, isLoading: loadingExpirations } = trpc.options.getExpirationDates.useQuery(
    { underlyingTicker: selectedTicker, contractType },
    { enabled: !!selectedTicker }
  );

  // Get strike prices for single leg
  const { data: strikePricesData, isLoading: loadingStrikes } = trpc.options.getStrikePrices.useQuery(
    { 
      underlyingTicker: selectedTicker, 
      expirationDate, 
      contractType 
    },
    { enabled: !!selectedTicker && !!expirationDate && !isSpread }
  );

  // Get strike prices for spread short leg
  const { data: shortStrikePricesData, isLoading: loadingShortStrikes } = trpc.options.getStrikePrices.useQuery(
    { 
      underlyingTicker: selectedTicker, 
      expirationDate, 
      contractType 
    },
    { enabled: !!selectedTicker && !!expirationDate && isSpread }
  );

  // Get strike prices for spread long leg (same as short leg data)
  const longStrikePricesData = shortStrikePricesData;

  // Auto-fetch premium for single leg
  const { data: premiumData, isLoading: loadingPremium } = trpc.options.getOptionQuote.useQuery(
    {
      underlyingTicker: selectedTicker,
      expirationDate,
      contractType,
      strikePrice: parseFloat(strikePrice),
    },
    { enabled: !!selectedTicker && !!expirationDate && !!strikePrice && !isSpread }
  );

  // Auto-fetch premium for spread short leg
  const { data: shortPremiumData, isLoading: loadingShortPremium } = trpc.options.getOptionQuote.useQuery(
    {
      underlyingTicker: selectedTicker,
      expirationDate,
      contractType,
      strikePrice: parseFloat(shortStrike),
    },
    { enabled: !!selectedTicker && !!expirationDate && !!shortStrike && isSpread }
  );

  // Auto-fetch premium for spread long leg
  const { data: longPremiumData, isLoading: loadingLongPremium } = trpc.options.getOptionQuote.useQuery(
    {
      underlyingTicker: selectedTicker,
      expirationDate,
      contractType,
      strikePrice: parseFloat(longStrike),
    },
    { enabled: !!selectedTicker && !!expirationDate && !!longStrike && isSpread }
  );

  // Auto-fill premium when data is fetched
  useEffect(() => {
    if (premiumData?.found && premiumData.midpoint) {
      setPremium(premiumData.midpoint.toFixed(2));
    }
  }, [premiumData]);

  useEffect(() => {
    if (shortPremiumData?.found && shortPremiumData.midpoint) {
      setShortPremium(shortPremiumData.midpoint.toFixed(2));
    }
  }, [shortPremiumData]);

  useEffect(() => {
    if (longPremiumData?.found && longPremiumData.midpoint) {
      setLongPremium(longPremiumData.midpoint.toFixed(2));
    }
  }, [longPremiumData]);

  // Auto-calculate when all parameters are filled
  useEffect(() => {
    if (!stockData?.price) {
      setShouldCalculate(false);
      return;
    }
    
    if (isSpread) {
      if (shortStrike && shortPremium && longStrike && longPremium) {
        setShouldCalculate(true);
      } else {
        setShouldCalculate(false);
      }
    } else {
      if (strikePrice && premium) {
        setShouldCalculate(true);
      } else {
        setShouldCalculate(false);
      }
    }
  }, [stockData, isSpread, strikePrice, premium, shortStrike, shortPremium, longStrike, longPremium]);
  
  const calculateParams = useMemo(() => {
    if (!stockData?.price) return null;
    
    if (isSpread) {
      if (!shortStrike || !shortPremium || !longStrike || !longPremium) return null;
      return {
        strategyType,
        currentPrice: stockData.price,
        shortStrike: parseFloat(shortStrike),
        shortPremium: parseFloat(shortPremium),
        longStrike: parseFloat(longStrike),
        longPremium: parseFloat(longPremium),
        quantity: parseInt(quantity) || 1,
      };
    } else {
      if (!strikePrice || !premium) return null;
      return {
        strategyType,
        currentPrice: stockData.price,
        strikePrice: parseFloat(strikePrice),
        premium: parseFloat(premium),
        quantity: parseInt(quantity) || 1,
      };
    }
  }, [strategyType, stockData, strikePrice, premium, shortStrike, shortPremium, longStrike, longPremium, quantity, isSpread]);

  const { data: metricsData, isLoading: calculatingMetrics } = trpc.options.calculateStrategy.useQuery(
    calculateParams!,
    { enabled: !!calculateParams && shouldCalculate }
  );

  // Generate P&L curve
  const plCurveParams = useMemo(() => {
    if (!stockData?.price || !calculateParams) return null;
    
    const legs = [];
    
    if (isSpread) {
      const isCallSpread = strategyType === "bear_call_spread";
      const spreadType: "call" | "put" = isCallSpread ? "call" : "put";
      legs.push({
        type: spreadType,
        position: "short" as const,
        strikePrice: parseFloat(shortStrike),
        premium: parseFloat(shortPremium),
        quantity: parseInt(quantity) || 1,
        sharesPerContract: 100,
      });
      legs.push({
        type: spreadType,
        position: "long" as const,
        strikePrice: parseFloat(longStrike),
        premium: parseFloat(longPremium),
        quantity: parseInt(quantity) || 1,
        sharesPerContract: 100,
      });
    } else {
      const isCall = strategyType === "long_call" || strategyType === "short_call";
      const isLong = strategyType === "long_call" || strategyType === "long_put";
      const legType: "call" | "put" = isCall ? "call" : "put";
      const legPosition: "long" | "short" = isLong ? "long" : "short";
      legs.push({
        type: legType,
        position: legPosition,
        strikePrice: parseFloat(strikePrice),
        premium: parseFloat(premium),
        quantity: parseInt(quantity) || 1,
        sharesPerContract: 100,
      });
    }
    
    return {
      legs,
      currentPrice: stockData.price,
      range: 0.3,
    };
  }, [stockData, calculateParams, strategyType, strikePrice, premium, shortStrike, shortPremium, longStrike, longPremium, quantity, isSpread]);

  const { data: plCurveData } = trpc.options.generatePLCurve.useQuery(
    plCurveParams!,
    { enabled: !!plCurveParams && shouldCalculate }
  );

  const handleTickerSelect = (symbol: string) => {
    setSelectedTicker(symbol);
    setTicker(""); // Clear search input to hide results
    setShouldCalculate(false);
    // Reset all parameters when changing ticker
    setExpirationDate("");
    setStrikePrice("");
    setPremium("");
    setShortStrike("");
    setShortPremium("");
    setLongStrike("");
    setLongPremium("");
  };

  const handleCalculate = () => {
    setShouldCalculate(true);
  };

  const canCalculate = () => {
    if (!stockData?.price) return false;
    if (isSpread) {
      return !!shortStrike && !!shortPremium && !!longStrike && !!longPremium;
    } else {
      return !!strikePrice && !!premium;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value === Infinity) return "Unlimited";
    return formatCurrency(value);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Options Strategy Analyzer</h1>
          <p className="text-muted-foreground">
            Evaluate risk and reward profiles for various options strategies
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Input Parameters */}
          <div className="lg:col-span-1 space-y-6">
            {/* Stock Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Stock Selection</CardTitle>
                <CardDescription>Search and select underlying stock</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTicker ? (
                  // Show selected ticker with option to change
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-accent rounded-md">
                      <div>
                        <div className="text-sm text-muted-foreground">Selected Stock</div>
                        <div className="text-xl font-bold">{selectedTicker}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTicker("");
                          setTicker("");
                        }}
                      >
                        Change
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Current Price:</span>
                      {loadingPrice ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="text-lg font-bold">
                          {stockData?.price ? formatCurrency(stockData.price) : "N/A"}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  // Show search input
                  <div>
                    <Label htmlFor="ticker">Stock Symbol</Label>
                    <div className="relative">
                      <Input
                        id="ticker"
                        placeholder="Enter ticker (e.g., AAPL)"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && ticker.trim()) {
                            handleTickerSelect(ticker.trim());
                          }
                        }}
                        className="uppercase"
                      />
                      {ticker.trim() && !searchingTickers && (
                        <Button
                          size="sm"
                          className="absolute right-1 top-1 h-7"
                          onClick={() => handleTickerSelect(ticker.trim())}
                        >
                          Use {ticker}
                        </Button>
                      )}
                    </div>
                    {searchingTickers && (
                      <div className="mt-2 flex items-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </div>
                    )}
                    {tickerResults && tickerResults.tickers.length > 0 && (
                      <div className="mt-2 border rounded-md divide-y max-h-64 overflow-y-auto">
                        {tickerResults.tickers.map((t) => (
                          <button
                            key={t.symbol}
                            onClick={() => handleTickerSelect(t.symbol)}
                            className="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                          >
                            <div className="font-medium">{t.symbol}</div>
                            <div className="text-sm text-muted-foreground truncate">{t.name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Strategy Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Strategy Type</CardTitle>
                <CardDescription>Select options strategy to analyze</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={strategyType} onValueChange={(v) => setStrategyType(v as StrategyType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div>
                          <div className="font-medium">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">{opt.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Strategy Parameters */}
            <Card>
              <CardHeader>
                <CardTitle>Strategy Parameters</CardTitle>
                <CardDescription>
                  {isSpread ? "Configure spread legs" : "Configure option parameters"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Expiration Date Selector */}
                <div>
                  <Label htmlFor="expirationDate">Expiration Date</Label>
                  <Select value={expirationDate} onValueChange={setExpirationDate}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingExpirations ? "Loading..." : "Select expiration date"} />
                    </SelectTrigger>
                    <SelectContent>
                      {expirationData?.expirationDates.map((date) => (
                        <SelectItem key={date} value={date}>
                          {new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isSpread ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Short Leg (Sell)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="shortStrike" className="text-xs">Strike Price</Label>
                          <Select value={shortStrike} onValueChange={setShortStrike} disabled={!expirationDate}>
                            <SelectTrigger>
                              <SelectValue placeholder={loadingShortStrikes ? "Loading..." : "Select strike"} />
                            </SelectTrigger>
                            <SelectContent>
                              {shortStrikePricesData?.strikePrices.map((item) => (
                                <SelectItem key={item.ticker} value={item.strikePrice.toString()}>
                                  ${item.strikePrice.toFixed(2)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="shortPremium" className="text-xs">Premium</Label>
                          <div className="relative">
                            <Input
                              id="shortPremium"
                              type="number"
                              step="0.01"
                              placeholder="Auto-filled"
                              value={shortPremium}
                              onChange={(e) => setShortPremium(e.target.value)}
                              className="pr-8"
                            />
                            {loadingShortPremium && (
                              <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Long Leg (Buy)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="longStrike" className="text-xs">Strike Price</Label>
                          <Select value={longStrike} onValueChange={setLongStrike} disabled={!expirationDate}>
                            <SelectTrigger>
                              <SelectValue placeholder={loadingShortStrikes ? "Loading..." : "Select strike"} />
                            </SelectTrigger>
                            <SelectContent>
                              {longStrikePricesData?.strikePrices.map((item) => (
                                <SelectItem key={item.ticker} value={item.strikePrice.toString()}>
                                  ${item.strikePrice.toFixed(2)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="longPremium" className="text-xs">Premium</Label>
                          <div className="relative">
                            <Input
                              id="longPremium"
                              type="number"
                              step="0.01"
                              placeholder="Auto-filled"
                              value={longPremium}
                              onChange={(e) => setLongPremium(e.target.value)}
                              className="pr-8"
                            />
                            {loadingLongPremium && (
                              <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="strikePrice">Strike Price</Label>
                      <Select value={strikePrice} onValueChange={setStrikePrice} disabled={!expirationDate}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingStrikes ? "Loading..." : "Select strike price"} />
                        </SelectTrigger>
                        <SelectContent>
                          {strikePricesData?.strikePrices.map((item) => (
                            <SelectItem key={item.ticker} value={item.strikePrice.toString()}>
                              ${item.strikePrice.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="premium">Premium (per share)</Label>
                      <div className="relative">
                        <Input
                          id="premium"
                          type="number"
                          step="0.01"
                          placeholder="Auto-filled"
                          value={premium}
                          onChange={(e) => setPremium(e.target.value)}
                          className="pr-8"
                        />
                        {loadingPremium && (
                          <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="quantity">Number of Contracts</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metrics Cards */}
            {metricsData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      Net Cost
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold number-display ${metricsData.netCost < 0 ? 'text-profit' : ''}`}>
                      {formatNumber(Math.abs(metricsData.netCost))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metricsData.netCost < 0 ? 'Credit Received' : 'Debit Paid'}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-profit" />
                      Max Profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-profit number-display">
                      {formatNumber(metricsData.maxProfit)}
                    </div>
                    {metricsData.returnOnRisk && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {metricsData.returnOnRisk.toFixed(1)}% ROI
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-loss" />
                      Max Loss
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-loss number-display">
                      {formatNumber(metricsData.maxLoss)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      Break-even
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold number-display">
                      {metricsData.breakEvenPoints.length > 0
                        ? formatCurrency(metricsData.breakEvenPoints[0])
                        : "N/A"}
                    </div>
                    {metricsData.profitProbability && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {metricsData.profitProbability.toFixed(1)}% profit probability
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* P&L Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Profit/Loss at Expiration</CardTitle>
                <CardDescription>
                  Strategy performance across different stock prices
                </CardDescription>
              </CardHeader>
              <CardContent>
                {calculatingMetrics ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : plCurveData?.curve ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={plCurveData.curve}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="stockPrice"
                        label={{ value: "Stock Price at Expiration", position: "insideBottom", offset: -5 }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <YAxis
                        label={{ value: "Profit/Loss", angle: -90, position: "insideLeft" }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), "P/L"]}
                        labelFormatter={(label) => `Price: ${formatCurrency(label)}`}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={2} />
                      {stockData?.price && (
                        <ReferenceLine
                          x={stockData.price}
                          stroke="hsl(var(--primary))"
                          strokeDasharray="5 5"
                          label={{ value: "Current", position: "top" }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="profitLoss"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Enter strategy parameters to see P/L chart
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
