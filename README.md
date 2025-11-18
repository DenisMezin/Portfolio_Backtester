# Portfolio Backtesting System

Un sistema avanzato di backtesting per portafogli di ETF con interfaccia web moderna e API robusta.

## Funzionalità

### Backtesting Avanzato

- Ribilanciamento periodico (mensile, trimestrale, annuale)
- Simulazione realistica dei costi di transazione
- Calcolo metriche complete: Sharpe Ratio, Sortino Ratio, Calmar Ratio, VaR, Beta
- Analisi del rischio: Maximum Drawdown, volatilità, downside deviation
- Confronto performance con benchmark

### Visualizzazioni

- Grafico performance cumulativa con confronto vs benchmark
- Analisi dei drawdown nel tempo
- Istogramma dei rendimenti mensili
- Tabella dettagliata delle metriche comparative

### Interfaccia

- Selezione da oltre 80 ETF organizzati per categoria
- Preset di portafogli predefiniti (Conservative, Balanced, Aggressive, Three Fund)
- Configurazione personalizzabili per date, investimento iniziale e costi
- Export risultati in formato CSV
- Indicatori di stato della connessione backend in tempo reale

## Setup Iniziale

### Requisiti

Assicurati di avere installato:

- Python 3.8+
- Node.js 14+
- npm

### Configurazione Backend

```bash
cd FastAPI/backend
pip install -r requirements.txt
```

### Configurazione Frontend

```bash
cd FastAPI/frontend
npm install
```

## Utilizzo

### Avvio del Sistema

Per avviare entrambi i server:

```bash
start_servers.bat
```

Accedi all'applicazione su `http://localhost:3000`

### Accesso ai Servizi

- Interfaccia Frontend: `http://localhost:3000`
- API Backend: `http://localhost:8000`
- Documentazione API: `http://localhost:8000/docs`

## Funzionamento

### Configurazione del Backtest

- Definire il periodo di analisi
- Specificare l'investimento iniziale
- Selezionare la frequenza di ribilanciamento
- Impostare i costi di transazione

### Selezione del Portafoglio

Il sistema offre due approcci:

1. Utilizzo dei preset (Conservative, Balanced, Aggressive, Three Fund)
2. Configurazione manuale degli asset con allocazione percentuale personalizzata

### Definizione del Benchmark

Scegli uno o più ETF come riferimento per il confronto. Esempi comuni:

- VT: Total World Stock
- SPY: S&P 500
- BND: Bond Aggregate

### Analisi dei Risultati

Visualizza le metriche di performance, i grafici interattivi e scarica i dati in CSV.

## Categorie ETF

Il sistema include ETF organizzati per categoria:

- **Mercati**: VTI, SPY, VXUS, VWO, QQQ
- **Obbligazioni**: BND, AGG, TLT
- **Immobiliare**: VNQ, IYR
- **Settori**: VGT, XLK, FSELX
- **Small Cap**: VB, IWM
- **Dividendi**: VYM, NOBL, SCHD
- **Commodities**: DJP, PDBC, GSG
- **Metalli Preziosi**: GLD, IAU, SGOL
- **Criptovalute**: BITO, GBTC

## API

### Endpoint Principali

```
GET /api/tickers
Restituisce la lista completa dei ticker disponibili

GET /api/ticker-info/{ticker}
Informazioni dettagliate su un ticker specifico

POST /api/backtest
Esegue l'analisi di backtesting

POST /api/export-csv
Genera l'esportazione CSV dei risultati

GET /api/health
Verifica lo stato del backend
```

## Portafogli Esempio

### Conservative

- 60% BND (Obbligazioni)
- 30% VTI (Mercato USA)
- 10% VXUS (Internazionale)

### Balanced

- 60% VTI (Mercato USA)
- 30% VXUS (Internazionale)
- 10% BND (Obbligazioni)

### Aggressive

- 70% VTI (Mercato USA)
- 20% VXUS (Internazionale)
- 10% VB (Small Cap)

### Three Fund Portfolio

- 60% VTI (Mercato USA)
- 30% VXUS (Internazionale)
- 10% BND (Obbligazioni)

## Limitazioni

- I dati storici dipendono dalla disponibilità di Yahoo Finance
- I costi di gestione dei fondi non sono inclusi nella simulazione
- I costi di transazione sono semplificati
- Le tasse su capital gains non sono considerate

## Sviluppi Futuri

- Supporto per azioni individuali
- Analisi di correlazione tra asset
- Simulazioni Monte Carlo
- Portfolio optimization con metodo Markowitz
- Risk parity strategies
- Miglioramenti responsive design

## Licenza

MIT License