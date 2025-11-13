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

class BacktestConfig(BaseModel):
    start_date: str = "2010-01-01"
    end_date: str = datetime.now().strftime('%Y-%m-%d')
    initial_investment: float = 10000
    rebalance_frequency: str = "quarterly"  # monthly, quarterly, yearly, none
    transaction_cost: float = 0.001  # 0.1% per trade
    reinvest_dividends: bool = True

class PortfolioPayload(BaseModel):
    etfs: conlist(Etf, min_length=1) # pyright: ignore[reportInvalidTypeForm]
    benchmark: conlist(Etf, min_length=1) # type: ignore
    config: BacktestConfig = BacktestConfig()

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

def load_and_process_data(etfs: list[Etf], start_date: str, end_date: str) -> pd.DataFrame:
    """Carica i dati storici per una lista di ETF e li combina in un unico DataFrame."""
    tickers = [etf.name for etf in etfs]
    if not tickers:
        return pd.DataFrame()
    
    try:
        # Scarica i dati per tutti i ticker in una sola chiamata
        data = yf.download(tickers, start=start_date, end=end_date, progress=False)
        if data.empty:
            raise ValueError("Nessun dato scaricato. Controlla i ticker.")
        
        # Gestisce sia ticker singoli che multipli
        adj_close = data['Close'] if len(tickers) > 1 else data[['Close']].rename(columns={'Close': tickers[0]})
        
        return adj_close.dropna(how='all')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore nel caricamento dei dati: {e}")


def calculate_advanced_metrics(returns: pd.Series, benchmark_returns: pd.Series = None) -> dict:
    """Calcola metriche avanzate per una serie di rendimenti."""
    if returns.empty or len(returns) < 2:
        return {}

    cumulative_returns = (1 + returns).cumprod()
    total_days = (returns.index[-1] - returns.index[0]).days
    total_years = total_days / 365.25 if total_days > 0 else 0
    
    # CAGR
    cagr = (cumulative_returns.iloc[-1] / cumulative_returns.iloc[0]) ** (1 / total_years) - 1 if total_years > 0 else 0.0
    
    # Volatilità Annualizzata
    annual_volatility = returns.std() * np.sqrt(252)
    
    # Max Drawdown e Calmar Ratio
    running_max = cumulative_returns.cummax()
    drawdown = (cumulative_returns - running_max) / running_max
    max_drawdown = drawdown.min()
    calmar_ratio = cagr / abs(max_drawdown) if max_drawdown != 0 else 0.0
    
    # Sharpe Ratio
    risk_free_rate = 0.02
    excess_returns = returns - risk_free_rate / 252
    sharpe_ratio = excess_returns.mean() / returns.std() * np.sqrt(252) if returns.std() > 0 else 0.0
    
    # Sortino Ratio
    negative_returns = returns[returns < 0]
    downside_deviation = negative_returns.std() * np.sqrt(252)
    sortino_ratio = (cagr - risk_free_rate) / downside_deviation if downside_deviation > 0 else 0.0
    
    # VaR (Value at Risk) al 95%
    var_95 = np.percentile(returns, 5) * np.sqrt(252)
    
    # Beta vs benchmark (se fornito)
    beta = None
    if benchmark_returns is not None and len(benchmark_returns) == len(returns):
        covariance = np.cov(returns, benchmark_returns)[0][1]
        benchmark_var = np.var(benchmark_returns)
        beta = covariance / benchmark_var if benchmark_var != 0 else 0
    
    # Rendimenti annuali
    yearly_returns = returns.groupby(returns.index.year).apply(lambda x: (1 + x).prod() - 1)
    best_year = yearly_returns.max() if not yearly_returns.empty else 0
    worst_year = yearly_returns.min() if not yearly_returns.empty else 0
    
    # Win rate (percentuale di giorni positivi)
    win_rate = (returns > 0).sum() / len(returns)
    
    metrics = {
        "CAGR": cagr,
        "Annual Volatility": annual_volatility,
        "Max Drawdown": max_drawdown,
        "Calmar Ratio": calmar_ratio,
        "Sharpe Ratio": sharpe_ratio,
        "Sortino Ratio": sortino_ratio,
        "VaR 95%": var_95,
        "Best Year": best_year,
        "Worst Year": worst_year,
        "Win Rate": win_rate,
    }
    
    if beta is not None:
        metrics["Beta"] = beta
        
    return metrics


def apply_rebalancing(data: pd.DataFrame, weights: np.array, frequency: str, transaction_cost: float) -> pd.Series:
    """Applica il ribilanciamento periodico al portafoglio."""
    returns = data.pct_change().dropna()
    portfolio_value = pd.Series(index=returns.index, dtype=float)
    portfolio_value.iloc[0] = 1.0
    
    current_weights = weights.copy()
    last_rebalance = returns.index[0]
    
    for i, date in enumerate(returns.index[1:], 1):
        # Calcola i rendimenti del giorno
        daily_returns = returns.iloc[i]
        
        # Aggiorna il valore del portafoglio
        portfolio_return = np.sum(current_weights * daily_returns)
        portfolio_value.iloc[i] = portfolio_value.iloc[i-1] * (1 + portfolio_return)
        
        # Aggiorna i pesi correnti in base alla performance
        current_weights = current_weights * (1 + daily_returns) / (1 + portfolio_return)
        
        # Controlla se è tempo di ribilanciare
        should_rebalance = False
        if frequency == "monthly" and date.month != last_rebalance.month:
            should_rebalance = True
        elif frequency == "quarterly" and date.quarter != last_rebalance.quarter:
            should_rebalance = True
        elif frequency == "yearly" and date.year != last_rebalance.year:
            should_rebalance = True
            
        if should_rebalance:
            # Applica costi di transazione
            weight_changes = np.abs(current_weights - weights)
            total_transaction_cost = np.sum(weight_changes) * transaction_cost
            portfolio_value.iloc[i] *= (1 - total_transaction_cost)
            
            # Ribilancia
            current_weights = weights.copy()
            last_rebalance = date
    
    return portfolio_value.pct_change().dropna()


def fig_to_base64(fig) -> str:
    """Converte una figura Matplotlib in una stringa base64."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches='tight')
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode('utf-8')



# --- Endpoint dell'API ---

@app.get("/api/tickers", summary="Ottiene la lista dei ticker popolari")
async def get_popular_tickers():
    """
    Restituisce una lista di ticker ETF popolari organizzati per categoria.
    """
    tickers = {
        "US Total Market": ["VTI", "ITOT", "SPTM", "VT"],
        "S&P 500": ["SPY", "VOO", "IVV", "SPLG"],
        "International Developed": ["VXUS", "FTIHX", "IEFA", "VEA"],
        "Emerging Markets": ["VWO", "IEMG", "EEM", "FTEC"],
        "Bonds": ["BND", "AGG", "VBTLX", "TLT"],
        "Real Estate": ["VNQ", "REIT", "SCHH", "IYR"],
        "Technology": ["QQQ", "VGT", "XLK", "FTEC"],
        "Small Cap": ["VB", "IWM", "VTWO", "SCHA"]
    }
    
    # Lista piatta di tutti i ticker
    all_tickers = []
    for category_tickers in tickers.values():
        all_tickers.extend(category_tickers)
    
    return {
        "categories": tickers,
        "all_tickers": sorted(list(set(all_tickers)))
    }

@app.post("/api/backtest", summary="Esegue il backtesting di un portafoglio")
async def backtest_portfolio(payload: PortfolioPayload):
    """
    Riceve un portafoglio e un benchmark, esegue il backtesting e restituisce
    metriche di performance avanzate e grafici comparativi.
    """
    config = payload.config
    etf_data = load_and_process_data(payload.etfs, config.start_date, config.end_date)
    benchmark_data = load_and_process_data(payload.benchmark, config.start_date, config.end_date)

    # Allineamento delle date per un confronto equo
    common_start = max(etf_data.index.min(), benchmark_data.index.min())
    common_end = min(etf_data.index.max(), benchmark_data.index.max())
    etf_data = etf_data.loc[common_start:common_end].dropna()
    benchmark_data = benchmark_data.loc[common_start:common_end].dropna()

    if etf_data.empty or benchmark_data.empty:
        raise HTTPException(status_code=400, detail="Dati insufficienti per il periodo selezionato dopo l'allineamento.")

    # Pesatura e calcolo dei rendimenti con ribilanciamento
    etf_weights = np.array([etf.weight for etf in payload.etfs])
    etf_weights /= np.sum(etf_weights)
    
    benchmark_weights = np.array([b.weight for b in payload.benchmark])
    benchmark_weights /= np.sum(benchmark_weights)
    
    # Applica ribilanciamento se specificato
    if config.rebalance_frequency != "none":
        portfolio_returns = apply_rebalancing(etf_data, etf_weights, config.rebalance_frequency, config.transaction_cost)
        benchmark_returns = apply_rebalancing(benchmark_data, benchmark_weights, config.rebalance_frequency, config.transaction_cost)
    else:
        portfolio_returns = (etf_data.pct_change().dropna() * etf_weights).sum(axis=1)
        benchmark_returns = (benchmark_data.pct_change().dropna() * benchmark_weights).sum(axis=1)

    # Calcolo performance cumulativa
    portfolio_cumulative_returns = (1 + portfolio_returns).cumprod() * config.initial_investment
    benchmark_cumulative_returns = (1 + benchmark_returns).cumprod() * config.initial_investment
    
    # Calcolo metriche avanzate
    portfolio_metrics = calculate_advanced_metrics(portfolio_returns, benchmark_returns)
    benchmark_metrics = calculate_advanced_metrics(benchmark_returns)
    
    # Calcolo drawdown per il grafico
    portfolio_running_max = portfolio_cumulative_returns.cummax()
    portfolio_drawdown = (portfolio_cumulative_returns - portfolio_running_max) / portfolio_running_max
    
    # Creazione dei Grafici
    plt.style.use('seaborn-v0_8-whitegrid')
    
    # Grafico 1: Performance cumulativa
    fig1, ax1 = plt.subplots(figsize=(12, 7))
    ax1.plot(portfolio_cumulative_returns.index, portfolio_cumulative_returns, label="Portfolio", color='royalblue', linewidth=2)
    ax1.plot(benchmark_cumulative_returns.index, benchmark_cumulative_returns, label="Benchmark", color='darkorange', linewidth=2)
    ax1.set_title("Performance Cumulativa del Portafoglio vs Benchmark", fontsize=16)
    ax1.set_xlabel("Data", fontsize=12)
    ax1.set_ylabel(f"Valore ($ da {config.initial_investment:,.0f} iniziali)", fontsize=12)
    ax1.legend(fontsize=12)
    ax1.grid(True, which='both', linestyle='--', linewidth=0.5)
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))
    plt.tight_layout()
    
    performance_plot = fig_to_base64(fig1)
    
    # Grafico 2: Drawdown
    fig2, ax2 = plt.subplots(figsize=(12, 6))
    ax2.fill_between(portfolio_drawdown.index, portfolio_drawdown * 100, 0, alpha=0.3, color='red')
    ax2.plot(portfolio_drawdown.index, portfolio_drawdown * 100, color='darkred', linewidth=1)
    ax2.set_title("Drawdown del Portafoglio", fontsize=16)
    ax2.set_xlabel("Data", fontsize=12)
    ax2.set_ylabel("Drawdown (%)", fontsize=12)
    ax2.grid(True, which='both', linestyle='--', linewidth=0.5)
    plt.tight_layout()
    
    drawdown_plot = fig_to_base64(fig2)
    
    # Grafico 3: Distribuzione rendimenti mensili
    monthly_returns = portfolio_returns.resample('M').apply(lambda x: (1 + x).prod() - 1)
    fig3, ax3 = plt.subplots(figsize=(10, 6))
    ax3.hist(monthly_returns * 100, bins=30, alpha=0.7, color='steelblue', edgecolor='black')
    ax3.axvline(monthly_returns.mean() * 100, color='red', linestyle='--', linewidth=2, label=f'Media: {monthly_returns.mean()*100:.1f}%')
    ax3.set_title("Distribuzione Rendimenti Mensili", fontsize=16)
    ax3.set_xlabel("Rendimento Mensile (%)", fontsize=12)
    ax3.set_ylabel("Frequenza", fontsize=12)
    ax3.legend()
    ax3.grid(True, which='both', linestyle='--', linewidth=0.5)
    plt.tight_layout()
    
    distribution_plot = fig_to_base64(fig3)

    return {
        "metrics": {
            "portfolio": portfolio_metrics,
            "benchmark": benchmark_metrics,
        },
        "plots": {
            "performance": performance_plot,
            "drawdown": drawdown_plot,
            "distribution": distribution_plot,
        },
        "date_range": {
            "start": common_start.strftime('%Y-%m-%d'),
            "end": common_end.strftime('%Y-%m-%d'),
        },
        "config": {
            "initial_investment": config.initial_investment,
            "rebalance_frequency": config.rebalance_frequency,
            "transaction_cost": config.transaction_cost,
            "reinvest_dividends": config.reinvest_dividends,
        },
        "final_values": {
            "portfolio": portfolio_cumulative_returns.iloc[-1],
            "benchmark": benchmark_cumulative_returns.iloc[-1],
        }
    }