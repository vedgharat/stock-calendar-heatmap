from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import yfinance as yf
from datetime import datetime, timezone, timedelta

app = FastAPI()

# Allow frontend to access backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def clamp_year_range(year: int):
    """
    Returns (start_date, end_date) for Yahoo Finance.
    Clamps future years to today's date.
    """
    start = datetime(year, 1, 1, tzinfo=timezone.utc).date()
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc).date()

    today = datetime.now(timezone.utc).date()

    # Clamp future dates
    if start > today:
        return None, None

    if end > today + timedelta(days=1):
        end = today + timedelta(days=1)

    return start.isoformat(), end.isoformat()


@app.get("/api/prices/{symbol}")
def get_prices(symbol: str, year: int = Query(None)):
    """
    Returns daily OHLC data for a stock symbol.
    ALWAYS returns a JSON array (possibly empty).
    Filters out invalid / future / junk rows.
    """

    try:
        symbol = symbol.strip().upper()

        # Empty symbol → empty result
        if not symbol:
            return JSONResponse(status_code=200, content=[])

        ticker = yf.Ticker(symbol)

        # Fetch data
        if year is None:
            df = ticker.history(period="1y", interval="1d")
        else:
            start, end = clamp_year_range(int(year))
            if start is None:
                return JSONResponse(status_code=200, content=[])
            df = ticker.history(start=start, end=end, interval="1d")

        # Invalid or empty dataframe
        if df is None or df.empty:
            return JSONResponse(status_code=200, content=[])

        rows = []

        for idx, row in df.iterrows():
            try:
                # Extract date safely
                try:
                    date_str = idx.strftime("%Y-%m-%d")
                except Exception:
                    date_str = str(idx)[:10]

                open_price = row.get("Open")
                close_price = row.get("Close")

                # 🚫 FILTER INVALID / JUNK DATA
                if open_price is None or close_price is None:
                    continue
                if float(open_price) <= 0 or float(close_price) <= 0:
                    continue

                rows.append({
                    "date": date_str,
                    "open": float(open_price),
                    "close": float(close_price),
                    "high": None if row.get("High") is None else float(row.get("High")),
                    "low": None if row.get("Low") is None else float(row.get("Low")),
                    "volume": None if row.get("Volume") is None else int(row.get("Volume")),
                })

            except Exception:
                # Skip corrupted row
                continue

        return JSONResponse(status_code=200, content=rows)

    except Exception:
        # NEVER crash frontend — always return array
        return JSONResponse(status_code=200, content=[])
