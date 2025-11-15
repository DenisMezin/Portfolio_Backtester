import base64
import io
import json
from datetime import datetime
from io import StringIO
from typing import Dict, List, Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, conlist
import yfinance as yf
from p1 import PortfolioAnalyzer
from efficient_frontier import EtfInput, EfficientFrontierConfig, calculate_efficient_frontier


# --- Modelli di Dati per la richiesta API ---
class Etf(BaseModel):
    name: str
    weight: float
    ter: float = 0.0  # Total Expense Ratio (%) annuale

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
    title="Advanced Portfolio Backtesting API",
    description="Un'API avanzata per eseguire il backtesting di portafogli di ETF con grafici interattivi.",
    version="2.0.0",
)

# Configurazione CORS per permettere al frontend di comunicare con l'API
origins = [
    "http://localhost:3000",  # React dev server
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Funzioni Helper Avanzate ---

class AdvancedPortfolioAnalyzer:
    """
    Analizzatore di portafoglio avanzato che estende PortfolioAnalyzer
    con funzionalità di backtesting e metriche avanzate.
    """
    
    def __init__(self, etfs: List[Etf], benchmark: List[Etf], config: BacktestConfig):
        self.etfs = etfs
        self.benchmark = benchmark
        self.config = config
        
        # Converti in formato dizionario per PortfolioAnalyzer
        self.etf_tickers = {etf.name: etf.weight for etf in etfs}
        self.benchmark_tickers = {b.name: b.weight for b in benchmark}
        
        # Calcola TER complessivi
        self.portfolio_ter = sum(etf.weight * etf.ter for etf in etfs)
        self.benchmark_ter = sum(b.weight * b.ter for b in benchmark)
        
        self.analyzer = PortfolioAnalyzer(
            etf_tickers=self.etf_tickers,
            benchmark_tickers=self.benchmark_tickers,
            start_date=datetime.strptime(config.start_date, '%Y-%m-%d'),
            end_date=datetime.strptime(config.end_date, '%Y-%m-%d')
        )

    def run_advanced_backtest(self):
        """Esegue il backtest avanzato con tutte le metriche e grafici."""
        try:
            # Esegui l'analisi base
            self.analyzer.download_data()
            self.analyzer.calculate_portfolio()
            
            # Calcola metriche avanzate
            portfolio_data = self.analyzer.my_etf_filtered
            benchmark_data = self.analyzer.benchmark_filtered
            
            # Calcola rendimenti
            portfolio_returns = portfolio_data['Portfolio'].pct_change().dropna()
            benchmark_returns = benchmark_data['Benchmark'].pct_change().dropna()
            
            # Applica i costi TER
            portfolio_returns = self._apply_ter_costs(portfolio_returns, self.portfolio_ter)
            benchmark_returns = self._apply_ter_costs(benchmark_returns, self.benchmark_ter)
            
            # Calcola performance cumulativa
            portfolio_cumulative = (1 + portfolio_returns).cumprod() * self.config.initial_investment
            benchmark_cumulative = (1 + benchmark_returns).cumprod() * self.config.initial_investment
            
            # Metriche avanzate
            portfolio_metrics = self._calculate_advanced_metrics(portfolio_returns)
            benchmark_metrics = self._calculate_advanced_metrics(benchmark_returns)
            
            # Grafici matplotlib (fallback)
            plots = self._create_matplotlib_plots(
                portfolio_cumulative, benchmark_cumulative, 
                portfolio_returns, benchmark_returns
            )
            
            return {
                "success": True,
                "metrics": {
                    "portfolio": portfolio_metrics,
                    "benchmark": benchmark_metrics,
                },
                "plots": plots,
                "config": {
                    "start_date": self.config.start_date,
                    "end_date": self.config.end_date,
                    "initial_investment": self.config.initial_investment,
                    "portfolio_ter": round(self.portfolio_ter, 4),
                    "benchmark_ter": round(self.benchmark_ter, 4),
                },
                "final_values": {
                    "portfolio": float(portfolio_cumulative.iloc[-1]),
                    "benchmark": float(benchmark_cumulative.iloc[-1]),
                },
                "allocation": {
                    "portfolio": [{"name": etf.name, "weight": etf.weight, "ter": etf.ter} for etf in self.etfs],
                    "benchmark": [{"name": b.name, "weight": b.weight, "ter": b.ter} for b in self.benchmark]
                }
            }
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Errore nel backtest: {str(e)}")
    
    def _apply_ter_costs(self, returns: pd.Series, ter: float) -> pd.Series:
        """Applica i costi TER ai rendimenti."""
        daily_ter = ter / 252  # TER annuale convertito in giornaliero
        return returns - daily_ter
    
    def _calculate_advanced_metrics(self, returns: pd.Series) -> Dict:
        """Calcola metriche avanzate per una serie di rendimenti."""
        if returns.empty:
            return {}
        
        # Rendimenti annualizzati
        annual_return = (1 + returns.mean()) ** 252 - 1
        
        # Volatilità annualizzata
        annual_volatility = returns.std() * np.sqrt(252)
        
        # Sharpe Ratio
        risk_free_rate = 0.02
        sharpe_ratio = (annual_return - risk_free_rate) / annual_volatility if annual_volatility > 0 else 0
        
        # Max Drawdown
        cumulative = (1 + returns).cumprod()
        running_max = cumulative.cummax()
        drawdown = (cumulative - running_max) / running_max
        max_drawdown = drawdown.min()
        
        # Sortino Ratio
        negative_returns = returns[returns < 0]
        downside_deviation = negative_returns.std() * np.sqrt(252) if len(negative_returns) > 0 else 0
        sortino_ratio = (annual_return - risk_free_rate) / downside_deviation if downside_deviation > 0 else 0
        
        # Calmar Ratio
        calmar_ratio = annual_return / abs(max_drawdown) if max_drawdown != 0 else 0
        
        # VaR (Value at Risk) al 95%
        var_95 = np.percentile(returns, 5)
        
        return {
            "annual_return": round(annual_return, 4),
            "annual_volatility": round(annual_volatility, 4),
            "sharpe_ratio": round(sharpe_ratio, 4),
            "sortino_ratio": round(sortino_ratio, 4),
            "max_drawdown": round(max_drawdown, 4),
            "calmar_ratio": round(calmar_ratio, 4),
            "var_95": round(var_95, 4),
            "total_return": round((1 + returns).prod() - 1, 4)
        }
    
    def _create_matplotlib_plots(self, portfolio_cum, benchmark_cum, portfolio_returns, benchmark_returns):
        """Crea grafici usando matplotlib (fallback quando plotly non è disponibile)."""
        
        # 1. Performance Cumulativa
        fig1, ax1 = plt.subplots(figsize=(12, 8))
        ax1.plot(portfolio_cum.index, portfolio_cum.values, label='Portfolio', color='blue', linewidth=2)
        ax1.plot(benchmark_cum.index, benchmark_cum.values, label='Benchmark', color='orange', linewidth=2)
        ax1.set_title('Performance Cumulativa: Portfolio vs Benchmark', fontsize=16)
        ax1.set_xlabel('Data', fontsize=12)
        ax1.set_ylabel('Valore ($)', fontsize=12)
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        plt.tight_layout()
        performance_plot = self._fig_to_base64(fig1)
        
        # 2. Drawdown
        portfolio_cum_norm = portfolio_cum / portfolio_cum.iloc[0]
        running_max = portfolio_cum_norm.cummax()
        drawdown = (portfolio_cum_norm - running_max) / running_max
        
        fig2, ax2 = plt.subplots(figsize=(12, 6))
        ax2.fill_between(drawdown.index, drawdown.values * 100, 0, alpha=0.3, color='red')
        ax2.plot(drawdown.index, drawdown.values * 100, color='darkred', linewidth=1)
        ax2.set_title('Portfolio Drawdown', fontsize=16)
        ax2.set_xlabel('Data', fontsize=12)
        ax2.set_ylabel('Drawdown (%)', fontsize=12)
        ax2.grid(True, alpha=0.3)
        plt.tight_layout()
        drawdown_plot = self._fig_to_base64(fig2)
        
        # 3. Distribuzione Rendimenti
        monthly_returns = portfolio_returns.resample('M').apply(lambda x: (1 + x).prod() - 1)
        
        fig3, ax3 = plt.subplots(figsize=(10, 6))
        ax3.hist(monthly_returns * 100, bins=30, alpha=0.7, color='steelblue', edgecolor='black')
        ax3.axvline(monthly_returns.mean() * 100, color='red', linestyle='--', linewidth=2, 
                    label=f'Media: {monthly_returns.mean()*100:.1f}%')
        ax3.set_title('Distribuzione Rendimenti Mensili', fontsize=16)
        ax3.set_xlabel('Rendimento (%)', fontsize=12)
        ax3.set_ylabel('Frequenza', fontsize=12)
        ax3.legend()
        ax3.grid(True, alpha=0.3)
        plt.tight_layout()
        distribution_plot = self._fig_to_base64(fig3)
        
        # 4. Asset Allocation Pie Chart
        fig4, ax4 = plt.subplots(figsize=(8, 8))
        labels = [etf.name for etf in self.etfs]
        sizes = [etf.weight for etf in self.etfs]
        colors = plt.cm.Set3(np.linspace(0, 1, len(labels)))
        
        wedges, texts, autotexts = ax4.pie(sizes, labels=labels, autopct='%1.1f%%', 
                                          startangle=90, colors=colors)
        ax4.set_title('Allocazione Portfolio', fontsize=16)
        plt.tight_layout()
        allocation_plot = self._fig_to_base64(fig4)
        
        return {
            "performance": performance_plot,
            "drawdown": drawdown_plot,
            "distribution": distribution_plot,
            "allocation": allocation_plot
        }
    
    def _fig_to_base64(self, fig):
        """Converte una figura matplotlib in stringa base64."""
        buffer = io.BytesIO()
        fig.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.read()).decode()
        buffer.close()
        plt.close(fig)
        return img_base64


# --- Endpoint API ---

@app.get("/api/health")
async def health_check():
    """Endpoint per verificare lo stato del server."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/api/tickers")
async def get_available_tickers():
    """Restituisce i ticker disponibili organizzati per categoria."""
    tickers = {
        "US Equity ETFs": ["VTI", "VOO", "SPY", "QQQ", "VB", "VBR", "VUG", "VTV"],
        "International Equity ETFs": ["VXUS", "VEA", "VWO", "EFA", "EEM", "IEFA", "IEMG"],
        "Bond ETFs": ["BND", "VGIT", "VGLT", "TIP", "LQD", "HYG", "AGG", "GOVT"],
        "Sector ETFs": ["XLK", "XLF", "XLV", "XLE", "XLI", "XLY", "XLP", "XLRE"],
        "Global ETFs": ["VT", "ACWI", "FTIHX", "SWTSX"],
        "Commodity ETFs": ["GLD", "SLV", "PDBC", "DBC", "USO"]
    }
    
    all_tickers = []
    for category_tickers in tickers.values():
        all_tickers.extend(category_tickers)
    
    return {
        "categories": tickers,
        "all_tickers": sorted(all_tickers)
    }


@app.post("/api/backtest")
async def run_portfolio_backtest(payload: PortfolioPayload):
    """
    Esegue il backtesting avanzato di un portafoglio con grafici.
    """
    try:
        analyzer = AdvancedPortfolioAnalyzer(
            etfs=payload.etfs,
            benchmark=payload.benchmark,
            config=payload.config
        )
        
        results = analyzer.run_advanced_backtest()
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel backtesting: {str(e)}")


@app.post("/api/efficient-frontier")
async def efficient_frontier_analysis(payload: dict):
    """
    Esegue l'analisi della frontiera efficiente per un insieme di ETF.
    """
    etfs_data = payload.get('etfs', payload) if isinstance(payload.get('etfs'), list) else payload
    config_data = payload.get('config', {})
    
    # Convert to EtfInput objects
    etfs = [EtfInput(name=etf['name'], weight=etf['weight']) for etf in etfs_data if etf.get('name')]
    
    if len(etfs) < 2:
        raise HTTPException(status_code=400, detail="Sono necessari almeno 2 ETF per l'analisi della frontiera efficiente")
    
    # Create config object with provided values or defaults
    config = EfficientFrontierConfig(
        start_date=config_data.get('start_date', '2010-01-01'),
        end_date=config_data.get('end_date', datetime.now().strftime('%Y-%m-%d')),
        num_portfolios=config_data.get('num_portfolios', 50000),
        risk_free_rate=config_data.get('risk_free_rate', 0.02),
        num_efficient_portfolios=config_data.get('num_efficient_portfolios', 3)
    )
    
    try:
        result = calculate_efficient_frontier(etfs, config)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nell'analisi della frontiera efficiente: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)