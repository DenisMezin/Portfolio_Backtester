# Portfolio Backtesting System

Un sistema avanzato di backtesting per portafogli di ETF con interfaccia web moderna e API robusta.

## 🚀 Funzionalità

### ✨ Funzionalità Avanzate di Backtesting
- **Ribilanciamento Periodico**: Mensile, trimestrale, annuale
- **Costi di Transazione**: Simulazione realistica dei costi
- **Metriche Avanzate**: Sharpe Ratio, Sortino Ratio, Calmar Ratio, VaR, Beta
- **Analisi del Rischio**: Maximum Drawdown, volatilità, downside deviation
- **Confronto con Benchmark**: Performance relativa e assoluta

### 📊 Visualizzazioni
- **Grafico Performance Cumulativa**: Confronto portafoglio vs benchmark
- **Grafico Drawdown**: Analisi del rischio di perdita
- **Distribuzione Rendimenti**: Istogramma dei rendimenti mensili
- **Tabella Metriche**: Confronto dettagliato delle performance

### 🎯 Interfaccia User-Friendly
- **Menu a Tendina per Ticker**: Oltre 80 ETF organizzati per categoria
- **Preset di Portafogli**: Conservative, Balanced, Aggressive, Three Fund
- **Configurazione Avanzata**: Date personalizzabili, investimento iniziale, costi
- **Export Risultati**: Scarica i dati in formato CSV
- **Indicatori di Stato**: Connessione backend in tempo reale

## 🛠️ Installazione

### Prerequisiti
- Python 3.8+
- Node.js 14+
- npm o yarn

### 1. Clona il Repository
```bash
git clone <repository-url>
cd FastAPI
```

### 2. Setup Backend
```bash
cd FastAPI/backend
pip install -r requirements.txt
```

### 3. Setup Frontend
```bash
cd ../frontend
npm install
```

## 🚀 Avvio Rapido

### Opzione 1: Script Automatico (Windows)
```bash
# Dalla cartella principale del progetto
start_servers.bat
```

### Opzione 2: Avvio Manuale

#### Avvia Backend
```bash
cd FastAPI/backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Avvia Frontend (nuovo terminale)
```bash
cd FastAPI/frontend
npm start
```

## 🌐 Accesso

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Documentazione API**: http://localhost:8000/docs

## 📋 Come Utilizzare

### 1. Configurazione Backtest
- **Date**: Seleziona periodo di analisi
- **Investimento Iniziale**: Importo di partenza (default: $10,000)
- **Frequenza Ribilanciamento**: None, Mensile, Trimestrale, Annuale
- **Costi Transazione**: Percentuale per operazione (default: 0.1%)

### 2. Selezione Portafoglio
- **Preset Rapidi**: Conservative, Balanced, Aggressive, Three Fund
- **Selezione Manuale**: Scegli ETF da menu categorizzato
- **Peso Assets**: Specifica allocazione percentuale
- **Rimozione Assets**: Pulsante "Rimuovi" per ogni asset

### 3. Benchmark
- Seleziona uno o più ETF come benchmark di confronto
- Esempi popolari: VT (Total World), SPY (S&P 500), BND (Bonds)

### 4. Analisi Risultati
- **Metriche Performance**: CAGR, volatilità, Sharpe ratio, etc.
- **Grafici Interattivi**: Performance, drawdown, distribuzione
- **Export Dati**: Scarica risultati completi in CSV

## 📊 Categorie ETF Disponibili

- **US Total Market**: VTI, ITOT, SPTM, VT, FZROX
- **S&P 500**: SPY, VOO, IVV, SPLG, FXAIX
- **International Developed**: VXUS, IEFA, VEA, FZILX
- **Emerging Markets**: VWO, IEMG, EEM, FPADX
- **Bonds**: BND, AGG, VBTLX, TLT, FXNAX
- **Real Estate**: VNQ, SCHH, IYR, FREL
- **Technology**: QQQ, VGT, XLK, FSELX
- **Small Cap**: VB, IWM, VTWO, FSMDX
- **Value/Growth**: VTV, VUG, FVAL, FSPGX
- **Dividend**: VYM, NOBL, SCHD, FDVV
- **Commodities**: DJP, PDBC, GSG, FCOM
- **Gold**: GLD, IAU, SGOL, AAAU
- **Crypto**: BITO, GBTC, ETHE

## 🔧 API Endpoints

- `GET /api/tickers` - Lista ticker disponibili
- `GET /api/ticker-info/{ticker}` - Informazioni dettagliate ticker
- `POST /api/backtest` - Esegui backtesting
- `POST /api/export-csv` - Esporta risultati CSV
- `GET /api/health` - Health check

## 🎯 Esempi di Portafogli

### Conservative (Basso Rischio)
- 60% BND (Bonds)
- 30% VTI (US Total Market)
- 10% VXUS (International)

### Balanced (Rischio Moderato)
- 60% VTI (US Total Market)
- 30% VXUS (International)
- 10% BND (Bonds)

### Aggressive (Alto Rischio)
- 70% VTI (US Total Market)
- 20% VXUS (International)
- 10% VB (Small Cap)

### Three Fund Portfolio
- 60% VTI (US Total Market)
- 30% VXUS (International)
- 10% BND (Bonds)

## 🛡️ Limitazioni

- Dati storici limitati alla disponibilità di Yahoo Finance
- Non include costi di gestione dei fondi
- Simulazione semplificata dei costi di transazione
- Non considera tasse su capital gains

## 🆘 Troubleshooting

### Backend non si avvia
```bash
# Verifica installazione dipendenze
pip install -r requirements.txt

# Verifica porta disponibile
netstat -an | findstr :8000
```

### Frontend non si connette al Backend
- Verifica che il backend sia in esecuzione su porta 8000
- Controlla l'indicatore di stato nell'interfaccia
- Verifica CORS settings nel backend

### Errori sui Dati
- Alcuni ticker potrebbero non essere disponibili
- Periodi troppo lunghi potrebbero causare timeout
- Verifica connessione internet per download dati

## 📈 Prossimi Sviluppi

- [ ] Supporto azioni individuali
- [ ] Analisi di correlazione tra assets
- [ ] Monte Carlo simulation
- [ ] Backtesting con dividendi storici reali
- [ ] Portfolio optimization (Markowitz)
- [ ] Risk parity strategies
- [ ] Mobile responsive design improvements

## 📄 Licenza

MIT License - Vedi file LICENSE per dettagli.

## 🤝 Contributi

I contributi sono benvenuti! Per favore:
1. Fork del progetto
2. Crea feature branch
3. Commit delle modifiche
4. Push al branch
5. Apri Pull Request

---

**Sviluppato con ❤️ usando FastAPI, React, e le migliori pratiche di sviluppo moderno.**