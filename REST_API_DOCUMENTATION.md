# REST API Documentation for iOS App

Base URL: `https://your-domain.com/api/rest`

All endpoints return JSON responses.

## Endpoints

### 1. Get Stock Price

Get the current price for a stock ticker.

**Endpoint:** `GET /stocks/:ticker/price`

**Parameters:**
- `ticker` (path parameter): Stock ticker symbol (e.g., "AAPL", "COIN")

**Response:**
```json
{
  "ticker": "COIN",
  "price": 165.12
}
```

**Error Response:**
```json
{
  "error": "Stock not found"
}
```

---

### 2. Search Stocks

Search for stock tickers (for autocomplete).

**Endpoint:** `GET /stocks/search`

**Query Parameters:**
- `query` (required): Search query string

**Response:**
```json
{
  "results": [
    {
      "symbol": "COIN",
      "name": "Coinbase Global, Inc. Class A Common Stock"
    },
    {
      "symbol": "AAPL",
      "name": "Apple Inc."
    }
  ]
}
```

---

### 3. Get Expiration Dates

Get available expiration dates for options on a stock.

**Endpoint:** `GET /stocks/:ticker/options/expirations`

**Parameters:**
- `ticker` (path parameter): Stock ticker symbol
- `contractType` (query parameter, optional): "call" or "put" (default: "call")

**Response:**
```json
{
  "expirationDates": [
    "2026-02-13",
    "2026-02-20",
    "2026-02-27",
    "2026-03-06"
  ]
}
```

---

### 4. Get Strike Prices with Delta Values

Get available strike prices and their Delta values for a specific expiration date.

**Endpoint:** `GET /stocks/:ticker/options/strikes`

**Parameters:**
- `ticker` (path parameter): Stock ticker symbol
- `expirationDate` (query parameter, required): Expiration date in YYYY-MM-DD format
- `contractType` (query parameter, optional): "call" or "put" (default: "call")

**Response:**
```json
{
  "strikePrices": [
    {
      "strikePrice": 165.0,
      "ticker": "O:COIN260213C00165000",
      "delta": 0.544
    },
    {
      "strikePrice": 170.0,
      "ticker": "O:COIN260213C00170000",
      "delta": 0.453
    }
  ]
}
```

---

### 5. Get Option Quote

Get the current quote for a specific option contract.

**Endpoint:** `GET /options/quote`

**Query Parameters:**
- `underlyingTicker` (required): Stock ticker symbol
- `expirationDate` (required): Expiration date in YYYY-MM-DD format
- `contractType` (required): "call" or "put"
- `strikePrice` (required): Strike price as a number

**Response:**
```json
{
  "found": true,
  "bid": 9.25,
  "ask": 9.25,
  "last": 9.25,
  "midpoint": 9.25,
  "impliedVolatility": 1.046529127121816,
  "openInterest": 2406,
  "greeks": {
    "delta": 0.544,
    "gamma": 0.012,
    "theta": -0.05,
    "vega": 0.15
  }
}
```

**Not Found Response:**
```json
{
  "found": false,
  "bid": null,
  "ask": null,
  "last": null,
  "midpoint": null,
  "impliedVolatility": null,
  "openInterest": null,
  "greeks": null
}
```

---

### 6. Calculate Strategy P&L

Calculate profit/loss curve and metrics for an options strategy.

**Endpoint:** `POST /options/calculate`

**Request Body:**
```json
{
  "currentPrice": 165.12,
  "legs": [
    {
      "type": "call",
      "position": "long",
      "strikePrice": 165.0,
      "premium": 9.25,
      "quantity": 1,
      "sharesPerContract": 100
    }
  ]
}
```

**Leg Parameters:**
- `type`: "call" or "put"
- `position`: "long" (buy) or "short" (sell)
- `strikePrice`: Strike price of the option
- `premium`: Premium per share (not per contract)
- `quantity`: Number of contracts
- `sharesPerContract`: Usually 100

**Response:**
```json
{
  "curve": [
    {
      "stockPrice": 115,
      "profitLoss": -925
    },
    {
      "stockPrice": 125,
      "profitLoss": -925
    },
    {
      "stockPrice": 165,
      "profitLoss": -925
    },
    {
      "stockPrice": 175,
      "profitLoss": 75
    }
  ],
  "metrics": {
    "netCost": 925.0,
    "maxProfit": null,
    "maxLoss": -925.0,
    "breakEvenPoints": [174.25]
  }
}
```

**Metrics:**
- `netCost`: Total cost of the strategy (positive for debit, negative for credit)
- `maxProfit`: Maximum profit (null for unlimited)
- `maxLoss`: Maximum loss (null for unlimited)
- `breakEvenPoints`: Array of stock prices where P&L = 0

---

## Error Handling

All endpoints may return error responses with HTTP status codes:

- `400 Bad Request`: Missing or invalid parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error response format:
```json
{
  "error": "Error message description"
}
```

---

## Example Usage in Swift

### Get Stock Price
```swift
let url = URL(string: "https://your-domain.com/api/rest/stocks/COIN/price")!
let task = URLSession.shared.dataTask(with: url) { data, response, error in
    if let data = data {
        let decoder = JSONDecoder()
        if let stockPrice = try? decoder.decode(StockPriceResponse.self, from: data) {
            print("Price: \\(stockPrice.price)")
        }
    }
}
task.resume()
```

### Calculate Strategy
```swift
let url = URL(string: "https://your-domain.com/api/rest/options/calculate")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body: [String: Any] = [
    "currentPrice": 165.12,
    "legs": [
        [
            "type": "call",
            "position": "long",
            "strikePrice": 165.0,
            "premium": 9.25,
            "quantity": 1,
            "sharesPerContract": 100
        ]
    ]
]

request.httpBody = try? JSONSerialization.data(withJSONObject: body)

let task = URLSession.shared.dataTask(with: request) { data, response, error in
    if let data = data {
        let decoder = JSONDecoder()
        if let result = try? decoder.decode(CalculateResponse.self, from: data) {
            print("Break-even: \\(result.metrics.breakEvenPoints)")
        }
    }
}
task.resume()
```

---

## Notes

- All prices are in USD
- All dates are in YYYY-MM-DD format
- Premium values are per share, not per contract (multiply by 100 for contract cost)
- Delta values range from 0 to 1 for calls, -1 to 0 for puts
- The API uses the Polygon.io data source
