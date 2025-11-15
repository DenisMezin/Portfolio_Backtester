import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import yfinance as yf
from datetime import datetime
from typing import Dict, List, Tuple, Optional

class PortfolioAnalyzer:
    """
    Una classe per scaricare i dati finanziari, costruire un portafoglio ETF
    e confrontarlo con un benchmark, fornendo analisi e grafici.
    
    Tutti i dati necessari (ETF/pesi, Benchmark/pesi, date) sono forniti
    durante l'inizializzazione della classe, tipicamente da un endpoint API.
    """

    def __init__(self,
                 etf_tickers: Dict[str, float],
                 benchmark_tickers: Dict[str, float],
                 start_date: datetime,
                 end_date: datetime = datetime.now(),
                 my_etf_label: str = "ETF Portfolio",
                 benchmark_label: str = "Benchmark"):
        """
        Inizializza l'analizzatore di portafoglio con i parametri di configurazione forniti dall'utente.

        :param etf_tickers: Dizionario di ticker ETF e loro pesi (es. {'AGG': 0.20}). **FORNITO DALL'UTENTE/ENDPOINT.**
        :param benchmark_tickers: Dizionario di ticker Benchmark e loro pesi (es. {'VT': 0.50}). **FORNITO DALL'UTENTE/ENDPOINT.**
        :param start_date: Data di inizio per il download dei dati.
        :param end_date: Data di fine per il download dei dati.
        :param my_etf_label: Etichetta da usare per il portafoglio.
        :param benchmark_label: Etichetta da usare per il benchmark.
        """
        # I parametri etf_tickers e benchmark_tickers sono ora obbligatori al momento della creazione
        # della classe (rimosso il default nel metodo per enfasi)
        self.etf_tickers = etf_tickers
        self.benchmark_tickers = benchmark_tickers
        self.start_date = start_date
        self.end_date = end_date
        self.my_etf_label = my_etf_label
        self.benchmark_label = benchmark_label

        # ... (il resto dell'inizializzazione rimane invariato)
        self.individual_assets: Dict[str, pd.Series] = {}
        self.etf_data: Dict[str, pd.Series] = {}
        self.benchmark_data: Dict[str, pd.Series] = {}
        self.my_etf_combined: Optional[pd.DataFrame] = None
        self.benchmark_combined: Optional[pd.DataFrame] = None
        self.my_etf_filtered: Optional[pd.DataFrame] = None
        self.benchmark_filtered: Optional[pd.DataFrame] = None
        self.normalized_assets: Dict[str, pd.Series] = {}
        self.common_start: Optional[datetime] = None
        self.common_end: Optional[datetime] = None

    def _download_and_weight_data(self, tickers_weights: Dict[str, float], is_etf_portfolio: bool = False) -> Dict[str, pd.Series]:
        """Funzione interna per scaricare e pesare i dati."""
        data_store = {}
        for ticker, weight in tickers_weights.items():
            print(f"  Downloading {ticker}...")
            # progress=False per output pulito, usa .date() per yf.download
            # Nota: yfinance può dare problemi con gli oggetti datetime.datetime, 
            # è più sicuro passare le date come stringhe 'YYYY-MM-DD' o oggetti datetime.date.
            start_date_str = self.start_date.strftime('%Y-%m-%d')
            end_date_str = self.end_date.strftime('%Y-%m-%d')
            data = yf.download(ticker, start=start_date_str, end=end_date_str, progress=False)
            
            if not data.empty:
                # Usa 'Adj Close' se disponibile, altrimenti 'Close'
                if 'Adj Close' in data.columns:
                    prices = data['Adj Close']
                else:
                    prices = data['Close']
                
                # Assicurati che sia una Series
                if isinstance(prices, pd.DataFrame):
                    prices = prices.squeeze()
                
                # Memorizza i prezzi pesati
                data_store[ticker] = prices * weight
                
                # Se è il portafoglio ETF, memorizza i prezzi non pesati per l'analisi individuale
                if is_etf_portfolio:
                    self.individual_assets[ticker] = prices
        return data_store

    def download_data(self):
        """Scarica i dati per il portafoglio ETF e per il benchmark."""
        # Aggiunta di una validazione di base sui pesi per chiarezza
        if not (self.etf_tickers and self.benchmark_tickers):
             raise ValueError("I dizionari di ETF/Pesi e Benchmark/Pesi non possono essere vuoti.")
             
        # Verifica che i pesi sommino a 1 (o vicino a 1)
        if abs(sum(self.etf_tickers.values()) - 1.0) > 1e-6:
             print(f"Warning: ETF weights sum to {sum(self.etf_tickers.values()):.2f}, not 1.0. Proceeding anyway.")


        print("Downloading ETF data...")
        self.etf_data = self._download_and_weight_data(self.etf_tickers, is_etf_portfolio=True)
        
        print("Downloading benchmark data...")
        self.benchmark_data = self._download_and_weight_data(self.benchmark_tickers)
        
        # Combina i dati pesati in un DataFrame
        self.my_etf_combined = pd.DataFrame(self.etf_data)
        self.benchmark_combined = pd.DataFrame(self.benchmark_data)
        
        if self.my_etf_combined.empty or self.benchmark_combined.empty:
            raise ValueError("Impossibile scaricare dati sufficienti per il portafoglio o il benchmark.")

    # I metodi calculate_portfolio(), plot_analysis(), e get_summary_statistics() rimangono invariati
    # rispetto alla versione precedente, in quanto già incapsulano correttamente la logica.
    
    def calculate_portfolio(self):
        """Calcola il portafoglio combinato, il benchmark e normalizza i dati."""
        if self.my_etf_combined is None or self.benchmark_combined is None:
            raise RuntimeError("Dati non ancora scaricati. Chiamare prima download_data().")

        # Trova l'intervallo di date comune
        # Assicurati che gli indici siano di tipo datetime. In genere yf.download lo fa.
        try:
            self.common_start = max(self.my_etf_combined.index.min(), self.benchmark_combined.index.min())
            self.common_end = min(self.my_etf_combined.index.max(), self.benchmark_combined.index.max())
        except AttributeError:
             raise RuntimeError("Gli indici dei DataFrame non sono del tipo atteso (DatetimeIndex).")


        # Filtra sull'intervallo comune e crea COPIE per l'elaborazione
        self.my_etf_filtered = self.my_etf_combined[(self.my_etf_combined.index >= self.common_start) &
                                                   (self.my_etf_combined.index <= self.common_end)].copy()
        self.benchmark_filtered = self.benchmark_combined[(self.benchmark_combined.index >= self.common_start) &
                                                         (self.benchmark_combined.index <= self.common_end)].copy()

        # Somma i componenti pesati
        self.my_etf_filtered['Portfolio'] = self.my_etf_filtered.sum(axis=1)
        self.benchmark_filtered['Benchmark'] = self.benchmark_filtered.sum(axis=1)

        # Normalizza (Portfolio e Benchmark)
        self.my_etf_filtered['Normalized'] = self.my_etf_filtered['Portfolio'] / self.my_etf_filtered['Portfolio'].iloc[0]
        self.benchmark_filtered['Normalized'] = self.benchmark_filtered['Benchmark'] / self.benchmark_filtered['Benchmark'].iloc[0]
        
        # Normalizza gli asset individuali (non pesati)
        for ticker, data in self.individual_assets.items():
            asset_filtered = data[(data.index >= self.common_start) & (data.index <= self.common_end)]
            # Ignora l'asset se il primo valore è NaN o 0
            if asset_filtered.iloc[0] != 0 and not pd.isna(asset_filtered.iloc[0]):
                self.normalized_assets[ticker] = asset_filtered / asset_filtered.iloc[0]
            else:
                print(f"Warning: First value for {ticker} is non-positive or NaN, skipping normalization.")


    def plot_analysis(self):
        """Genera e mostra i 3 grafici (Normalized vs Benchmark, Pie Chart, Individual Assets)."""
        if self.my_etf_filtered is None or self.benchmark_filtered is None or self.common_start is None:
            raise RuntimeError("L'analisi non è stata ancora eseguita. Chiamare prima calculate_portfolio().")
            
        fig = plt.figure(figsize=(20, 16))
        gs = fig.add_gridspec(2, 2)

        # 1. Normalized Portfolio vs Benchmark
        ax1 = fig.add_subplot(gs[0, :])
        ax1.plot(self.my_etf_filtered.index, self.my_etf_filtered['Normalized'], label=self.my_etf_label, linewidth=2)
        ax1.plot(self.benchmark_filtered.index, self.benchmark_filtered['Normalized'], label=self.benchmark_label, linewidth=2)
        ax1.set_title(f'Normalized Portfolio vs {self.benchmark_label}\n'
                      f'(Date Range: {self.common_start.date()} to {self.common_end.date()})', fontsize=14)
        ax1.set_xlabel('Date', fontsize=12)
        ax1.set_ylabel('Normalized Value', fontsize=12)
        ax1.legend(fontsize=12)
        ax1.grid(True, alpha=0.3)

        # 2. Pie chart of ETF allocations
        ax2 = fig.add_subplot(gs[1, 0])
        labels = list(self.etf_tickers.keys())
        sizes = list(self.etf_tickers.values())
        # Imposta la soglia per l'autopct
        def my_autopct(pct):
            return ('%1.1f%%' % pct) if pct > 5 else ''
            
        ax2.pie(sizes, labels=labels, autopct=my_autopct, startangle=90)
        ax2.axis('equal')
        ax2.set_title(f'{self.my_etf_label} Allocation', fontsize=14)

        # 3. Individual Asset Growth with Benchmark
        ax3 = fig.add_subplot(gs[1, 1])
        for ticker, data in self.normalized_assets.items():
            ax3.plot(data.index, data.values, label=ticker, linewidth=2)

        # Add the benchmark as a dotted black line
        ax3.plot(self.benchmark_filtered.index, self.benchmark_filtered['Normalized'], 'k:',
                 label=self.benchmark_label, linewidth=2)

        ax3.set_xlabel('Date', fontsize=12)
        ax3.set_ylabel('Normalized Value', fontsize=12)
        ax3.set_title('Individual Asset Growth and Benchmark (Normalized to 1)', fontsize=14)
        ax3.legend(fontsize=12)
        ax3.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.show()

    def get_summary_statistics(self) -> Dict[str, float]:
        """Restituisce le statistiche di performance come dizionario."""
        if self.my_etf_filtered is None or self.benchmark_filtered is None or self.common_start is None:
            raise RuntimeError("L'analisi non è stata ancora eseguita. Chiamare prima calculate_portfolio().")

        portfolio_return = (self.my_etf_filtered['Normalized'].iloc[-1] - 1) * 100
        benchmark_return = (self.benchmark_filtered['Normalized'].iloc[-1] - 1) * 100
        outperformance = ((self.my_etf_filtered['Normalized'].iloc[-1] / self.benchmark_filtered['Normalized'].iloc[-1]) - 1) * 100

        return {
            "date_start": self.common_start.date().isoformat(),
            "date_end": self.common_end.date().isoformat(),
            f"{self.my_etf_label}_total_return_percent": round(portfolio_return, 2),
            f"{self.benchmark_label}_total_return_percent": round(benchmark_return, 2),
            "outperformance_percent": round(outperformance, 2)
        }


# --- Blocco di Esecuzione di Esempio (per testare il modulo direttamente) ---
# QUESTA SEZIONE CONTIENE I DATI DI ESEMPIO CHE L'UTENTE FINALE DEVE FORNIRE AL MODULO
if __name__ == "__main__":
    
    # -------------------------------------------------------------------------
    # CONFIGURAZIONE FORNITA DALL'UTENTE (Simulazione input da endpoint/main.py)
    # -------------------------------------------------------------------------
    
    # Portafoglio Scelto dall'Utente
    etf_cfg_utente = {
        'AGG': 0.20,      # Esempio: 20% Obbligazionario
        'SWDA.MI': 0.80   # Esempio: 80% Azionario Globale
    }
    
    # Benchmark di Confronto Scelto dall'Utente
    benchmark_cfg_utente = {
        'VT': 0.50,       # Esempio: 50% Azionario Totale Mondo
        'GOVT': 0.50      # Esempio: 50% Obbligazionario Governativo USA
    }
    
    start_dt_utente = datetime(2004, 1, 1)
    
    # -------------------------------------------------------------------------
    
    print("--- Esecuzione di test del modulo portfolio_analysis.py ---")
    
    # 1. Inizializzazione della Classe con la configurazione dell'utente
    analyzer = PortfolioAnalyzer(
        etf_tickers=etf_cfg_utente,
        benchmark_tickers=benchmark_cfg_utente,
        start_date=start_dt_utente
    )

    # 2. Esecuzione dei Metodi
    try:
        analyzer.download_data()
        analyzer.calculate_portfolio()
        
        # 3. Ottenere le Statistiche (risposta tipica per un endpoint API)
        stats = analyzer.get_summary_statistics()
        
        print("\n--- Risultati Analisi (Output per Endpoint) ---")
        for k, v in stats.items():
            print(f"{k}: {v}")

        # 4. Generare i Grafici (per visualizzazione in locale, da rimuovere per un server API headless)
        analyzer.plot_analysis()

    except Exception as e:
        print(f"An error occurred during analysis: {e}")