import base64
import io
from datetime import datetime

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, conlist
import yfinance as yf


# --- Modelli di Dati per la richiesta API ---
class Etf(BaseModel):
    name: str
    weight: float

class PortfolioPayload(BaseModel):
    etfs: conlist(Etf, min_length=1) # pyright: ignore[reportInvalidTypeForm]
    benchmark: conlist(Etf, min_length=1) # type: ignore

# --- Configurazione dell'App FastAPI ---
app = FastAPI(
    title="Portfolio Backtesting API",
    description="Un'API per eseguire il backtesting di portafogli di ETF.",
    version="1.0.0",
)

# Configurazione CORS per permettere al frontend di comunicare con l'API
origins = [
    "http://localhost:5173",  # Porta di default per Vite/React
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Funzioni Helper ---

def load_and_process_data(etfs: list[Etf]) -> pd.DataFrame:
    """Carica i dati storici per una lista di ETF e li combina in un unico DataFrame."""
    tickers = [etf.name for etf in etfs]
    if not tickers:
        return pd.DataFrame()
    
    try:
        # Scarica i dati per tutti i ticker in una sola chiamata
        data = yf.download(tickers, start="2000-01-01", progress=False)
        if data.empty:
            raise ValueError("Nessun dato scaricato. Controlla i ticker.")
        
        # Gestisce sia ticker singoli che multipli
        adj_close = data['Close'] if len(tickers) > 1 else data[['Close']].rename(columns={'Close': tickers[0]})
        
        return adj_close.dropna(how='all')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore nel caricamento dei dati: {e}")


def calculate_portfolio_metrics(cumulative_returns: pd.Series) -> dict:
    """Calcola le metriche chiave per una singola serie di rendimenti cumulativi."""
    if cumulative_returns.empty or len(cumulative_returns) < 2:
        return {}

    total_days = (cumulative_returns.index[-1] - cumulative_returns.index[0]).days
    total_years = total_days / 365.25 if total_days > 0 else 0
    
    # CAGR
    cagr = (cumulative_returns.iloc[-1] / cumulative_returns.iloc[0]) ** (1 / total_years) - 1 if total_years > 0 else 0.0
    
    # Volatilità Annualizzata
    daily_returns = cumulative_returns.pct_change().dropna()
    annual_volatility = daily_returns.std() * np.sqrt(252)

    # Max Drawdown
    running_max = cumulative_returns.cummax()
    drawdown = (cumulative_returns - running_max) / running_max
    max_drawdown = drawdown.min()

    # Sharpe Ratio (assumendo un risk-free rate del 2%)
    risk_free_rate = 0.02
    sharpe_ratio = (cagr - risk_free_rate) / annual_volatility if annual_volatility > 0 else 0.0

    return {
        "CAGR": cagr,
        "Annual Volatility": annual_volatility,
        "Max Drawdown": max_drawdown,
        "Sharpe Ratio": sharpe_ratio,
    }


def fig_to_base64(fig) -> str:
    """Converte una figura Matplotlib in una stringa base64."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches='tight')
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode('utf-8')



# --- Endpoint Principale dell'API ---

@app.post("/api/backtest", summary="Esegue il backtesting di un portafoglio")
async def backtest_portfolio(payload: PortfolioPayload):
    """
    Riceve un portafoglio e un benchmark, esegue il backtesting e restituisce
    metriche di performance e un grafico comparativo.
    """
    etf_data = load_and_process_data(payload.etfs)
    benchmark_data = load_and_process_data(payload.benchmark)

    # Allineamento delle date per un confronto equo
    common_start = max(etf_data.index.min(), benchmark_data.index.min())
    common_end = min(etf_data.index.max(), benchmark_data.index.max())
    etf_data = etf_data.loc[common_start:common_end].dropna()
    benchmark_data = benchmark_data.loc[common_start:common_end].dropna()

    if etf_data.empty or benchmark_data.empty:
        raise HTTPException(status_code=400, detail="Dati insufficienti per il periodo selezionato dopo l'allineamento.")

    # Pesatura e calcolo dei rendimenti
    etf_weights = np.array([etf.weight for etf in payload.etfs])
    etf_weights /= np.sum(etf_weights)
    
    benchmark_weights = np.array([b.weight for b in payload.benchmark])
    benchmark_weights /= np.sum(benchmark_weights)
    
    portfolio_returns = (etf_data.pct_change().dropna() * etf_weights).sum(axis=1)
    benchmark_returns = (benchmark_data[payload.benchmark[0].name].pct_change().dropna() * benchmark_weights).sum(axis=1)

    # Calcolo performance cumulativa
    portfolio_cumulative_returns = (1 + portfolio_returns).cumprod()
    benchmark_cumulative_returns = (1 + benchmark_returns).cumprod()
    
    # Calcolo metriche
    portfolio_metrics = calculate_portfolio_metrics(portfolio_cumulative_returns)
    benchmark_metrics = calculate_portfolio_metrics(benchmark_cumulative_returns)
    
    # Creazione del Grafico
    plt.style.use('seaborn-v0_8-whitegrid')
    fig, ax = plt.subplots(figsize=(12, 7))
    ax.plot(portfolio_cumulative_returns.index, portfolio_cumulative_returns, label="Portfolio", color='royalblue', linewidth=2)
    ax.plot(benchmark_cumulative_returns.index, benchmark_cumulative_returns, label="Benchmark", color='darkorange', linewidth=2)
    ax.set_title("Performance del Portafoglio vs Benchmark", fontsize=16)
    ax.set_xlabel("Data", fontsize=12)
    ax.set_ylabel("Valore Normalizzato", fontsize=12)
    ax.legend(fontsize=12)
    ax.grid(True, which='both', linestyle='--', linewidth=0.5)
    plt.tight_layout()
    
    plot_base64 = fig_to_base64(fig)

    return {
        "metrics": {
            "portfolio": portfolio_metrics,
            "benchmark": benchmark_metrics,
        },
        "plot": plot_base64,
        "date_range": {
            "start": common_start.strftime('%Y-%m-%d'),
            "end": common_end.strftime('%Y-%m-%d'),
        },
    }