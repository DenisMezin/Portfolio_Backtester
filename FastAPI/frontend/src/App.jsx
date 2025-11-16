import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Spinner, Alert, Tabs, Tab } from 'react-bootstrap';
import axios from 'axios';
import Plot from 'react-plotly.js';
import './App.css';

const API_URL = 'http://localhost:8000/api/backtest';
const TICKERS_URL = 'http://localhost:8000/api/tickers';

function App() {
    const [etfs, setEtfs] = useState([{ name: 'VTI', weight: '0.6', ter: '0.03' }, { name: 'VXUS', weight: '0.4', ter: '0.08' }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState(null);
    const [availableTickers, setAvailableTickers] = useState([]);
    const [tickerCategories, setTickerCategories] = useState({});
    const [backendStatus, setBackendStatus] = useState('connecting');
    
    const [config, setConfig] = useState({
        start_date: '1990-01-01',
        end_date: new Date().toISOString().split('T')[0],
        initial_investment: 10000,
        rebalance_frequency: 'quarterly',
        reinvest_dividends: true
    });

    useEffect(() => {
        const checkBackendAndFetchTickers = async () => {
            try {
                await axios.get('http://localhost:8000/api/health');
                setBackendStatus('connected');
                const response = await axios.get(TICKERS_URL);
                setAvailableTickers(response.data.all_tickers);
                setTickerCategories(response.data.categories);
            } catch (err) {
                console.error('Errore:', err);
                setBackendStatus('disconnected');
            }
        };
        checkBackendAndFetchTickers();
    }, []);

    const portfolioPresets = {
        "Conservative": [
            { name: 'BND', weight: '0.6', ter: '0.03' },
            { name: 'VTI', weight: '0.3', ter: '0.03' },
            { name: 'VXUS', weight: '0.1', ter: '0.08' }
        ],
        "Balanced": [
            { name: 'VTI', weight: '0.6', ter: '0.03' },
            { name: 'VXUS', weight: '0.3', ter: '0.08' },
            { name: 'BND', weight: '0.1', ter: '0.03' }
        ],
        "Aggressive": [
            { name: 'VTI', weight: '0.7', ter: '0.03' },
            { name: 'VXUS', weight: '0.2', ter: '0.08' },
            { name: 'VB', weight: '0.1', ter: '0.05' }
        ]
    };

    const loadPreset = (presetName) => {
        setEtfs([...portfolioPresets[presetName]]);
    };

    const handleConfigChange = (event) => {
        const { name, value, type, checked } = event.target;
        setConfig(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleRemoveField = (index) => {
        if (etfs.length > 1) {
            setEtfs(etfs.filter((_, i) => i !== index));
        }
    };

    const handleAddField = () => {
        setEtfs([...etfs, { name: '', weight: '', ter: '0.00' }]);
    };

    const handleInputChange = (index, event) => {
        const { name, value } = event.target;
        const newEtfs = [...etfs];
        newEtfs[index][name] = value;
        setEtfs(newEtfs);
    };
    
    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setResults(null);
        
        const payload = {
            etfs: etfs.map(e => ({...e, weight: parseFloat(e.weight) || 0, ter: parseFloat(e.ter) || 0})).filter(e => e.name),
            benchmark: [{ name: 'VT', weight: 1.0, ter: 0.08 }],
            config: {
                ...config,
                initial_investment: parseFloat(config.initial_investment)
            }
        };
        
        try {
            const response = await axios.post(API_URL, payload);
            setResults(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Errore nel backtest');
            console.error('Errore:', err);
        } finally {
            setLoading(false);
        }
    };

    const renderPlot = (plotData) => {
        if (!plotData) return null;
        if (plotData.data && plotData.layout) {
            return (
                <Plot
                    data={plotData.data}
                    layout={{
                        ...plotData.layout,
                        autosize: true,
                        responsive: true,
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(40,44,50,0.5)',
                        font: { color: '#e0e0e0' }
                    }}
                    config={{
                        displayModeBar: false,
                        displaylogo: false
                    }}
                    style={{ width: '100%', height: '400px' }}
                />
            );
        }
        return null;
    };

    // Portfolio Selection Section
    if (!results) {
        return (
            <div className="app-dark-bg">
                {backendStatus === 'disconnected' && (
                    <Alert variant="danger" className="mb-3">
                        <strong>⚠️ Backend non disponibile</strong>
                    </Alert>
                )}

                <div className="portfolio-section">
                    <Container fluid className="py-4">
                        <div className="page-title mb-4">
                            <h1>Portfolio Backtester</h1>
                        </div>

                        <Form onSubmit={handleSubmit}>
                            {/* Global Parameters Panel */}
                            <div className="params-panel mb-4">
                                <h3 className="panel-title">Global Parameters</h3>
                                <div className="params-grid">
                                    <div className="param-group">
                                        <label>Start Date</label>
                                        <Form.Control 
                                            type="date" 
                                            name="start_date"
                                            value={config.start_date}
                                            onChange={handleConfigChange}
                                            className="param-input"
                                        />
                                    </div>
                                    <div className="param-group">
                                        <label>End Date</label>
                                        <Form.Control 
                                            type="date" 
                                            name="end_date"
                                            value={config.end_date}
                                            onChange={handleConfigChange}
                                            className="param-input"
                                        />
                                    </div>
                                    <div className="param-group">
                                        <label>Starting Value</label>
                                        <div className="input-with-icon">
                                            <span className="icon">$</span>
                                            <Form.Control 
                                                type="number" 
                                                name="initial_investment"
                                                value={config.initial_investment}
                                                onChange={handleConfigChange}
                                                className="param-input"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <Button 
                                    type="submit" 
                                    className="btn-backtest"
                                    disabled={loading || backendStatus !== 'connected'}
                                >
                                    {loading ? (
                                        <>
                                            <Spinner as="span" animation="border" size="sm" className="me-2" />
                                            Running...
                                        </>
                                    ) : (
                                        'BACKTEST'
                                    )}
                                </Button>
                            </div>

                            {/* Portfolio Panel */}
                            <div className="portfolio-panel mb-4">
                                <div className="panel-header">
                                    <h3 className="panel-title">Portfolios</h3>
                                    <div className="portfolio-buttons">
                                        <Button variant="primary" size="sm" className="action-btn btn-add-empty">ADD EMPTY</Button>
                                        <Button variant="success" size="sm" className="action-btn btn-add-preset">ADD PRESET</Button>
                                        <Button variant="danger" size="sm" className="action-btn btn-add-saved">ADD SAVED</Button>
                                        <Button variant="info" size="sm" className="action-btn btn-add-guidepath">ADD GUIDEPATH</Button>
                                    </div>
                                </div>

                                <div className="portfolio-content">
                                    <h4 className="portfolio-subtitle">Portfolio 1</h4>
                                    <div className="preset-buttons mb-3">
                                        {Object.keys(portfolioPresets).map(preset => (
                                            <Button 
                                                key={preset}
                                                variant="outline-primary" 
                                                size="sm" 
                                                className="preset-btn"
                                                onClick={() => loadPreset(preset)}
                                            >
                                                {preset}
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="etf-list">
                                        {etfs.map((etf, i) => (
                                            <div key={i} className="etf-row">
                                                <Form.Select 
                                                    name="name" 
                                                    value={etf.name} 
                                                    onChange={e => handleInputChange(i, e)}
                                                    className="etf-select"
                                                >
                                                    <option value="">Select ticker...</option>
                                                    {Object.entries(tickerCategories).map(([category, tickers]) => (
                                                        <optgroup key={category} label={category}>
                                                            {tickers.map(ticker => (
                                                                <option key={ticker} value={ticker}>{ticker}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </Form.Select>
                                                <Form.Control 
                                                    type="number" 
                                                    name="weight" 
                                                    placeholder="%" 
                                                    value={etf.weight} 
                                                    onChange={e => handleInputChange(i, e)}
                                                    className="etf-input weight-input"
                                                    step="0.01" 
                                                    min="0" 
                                                />
                                                {etfs.length > 1 && (
                                                    <Button 
                                                        variant="outline-danger" 
                                                        size="sm" 
                                                        onClick={() => handleRemoveField(i)}
                                                        className="btn-remove"
                                                    >
                                                        ✕
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <Button 
                                        variant="outline-success" 
                                        size="sm" 
                                        onClick={handleAddField}
                                        className="btn-add-etf"
                                    >
                                        + Add ETF
                                    </Button>
                                </div>
                            </div>
                        </Form>

                        {error && (
                            <Alert variant="danger" className="mt-4">
                                {error}
                            </Alert>
                        )}
                    </Container>
                </div>
            </div>
        );
    }

    // Results Section
    return (
        <div className="app-dark-bg">
            <div className="results-section">
                <Container fluid className="py-4">
                    <div className="results-header mb-4">
                        <h2>Results</h2>
                        <div className="results-actions">
                            <span className="date-range">
                                ({config.start_date} to {config.end_date})
                            </span>
                            <Button 
                                variant="outline-secondary" 
                                size="sm"
                                onClick={() => setResults(null)}
                                className="btn-back"
                            >
                                ← Back
                            </Button>
                        </div>
                    </div>

                    {/* Results Tabs */}
                    <Tabs defaultActiveKey="summary" className="results-tabs mb-4">
                        <Tab eventKey="summary" title="SUMMARY">
                            <div className="stats-table-container">
                                <h4>Statistics</h4>
                                <div className="table-responsive">
                                    <table className="stats-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Ending Value</th>
                                                <th>Total Return</th>
                                                <th>CAGR</th>
                                                <th>Volatility</th>
                                                <th>Sharpe</th>
                                                <th>Max Drawdown</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>Portfolio</td>
                                                <td className="value-positive">${results.final_values?.portfolio?.toLocaleString()}</td>
                                                <td>{((results.metrics?.portfolio?.total_return ?? 0) * 100).toFixed(2)}%</td>
                                                <td className="value-positive">{((results.metrics?.portfolio?.annual_return ?? 0) * 100).toFixed(2)}%</td>
                                                <td>{((results.metrics?.portfolio?.annual_volatility ?? 0) * 100).toFixed(2)}%</td>
                                                <td>{(results.metrics?.portfolio?.sharpe_ratio ?? 0).toFixed(3)}</td>
                                                <td className="value-negative">{((results.metrics?.portfolio?.max_drawdown ?? 0) * 100).toFixed(2)}%</td>
                                            </tr>
                                            <tr>
                                                <td>Benchmark</td>
                                                <td className="value-positive">${results.final_values?.benchmark?.toLocaleString()}</td>
                                                <td>{((results.metrics?.benchmark?.total_return ?? 0) * 100).toFixed(2)}%</td>
                                                <td className="value-positive">{((results.metrics?.benchmark?.annual_return ?? 0) * 100).toFixed(2)}%</td>
                                                <td>{((results.metrics?.benchmark?.annual_volatility ?? 0) * 100).toFixed(2)}%</td>
                                                <td>{(results.metrics?.benchmark?.sharpe_ratio ?? 0).toFixed(3)}</td>
                                                <td className="value-negative">{((results.metrics?.benchmark?.max_drawdown ?? 0) * 100).toFixed(2)}%</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="chart-container mt-4">
                                <h4>Performance</h4>
                                {renderPlot(results.plots?.performance)}
                            </div>
                        </Tab>

                        <Tab eventKey="returns" title="RETURNS">
                            {renderPlot(results.plots?.distribution)}
                        </Tab>

                        <Tab eventKey="drawdown" title="DRAWDOWN">
                            {renderPlot(results.plots?.drawdown)}
                        </Tab>

                        <Tab eventKey="allocation" title="ALLOCATION">
                            {renderPlot(results.plots?.allocation)}
                        </Tab>
                    </Tabs>

                    <div className="text-center mt-4">
                        <Button 
                            variant="secondary" 
                            size="lg"
                            onClick={() => setResults(null)}
                            className="btn-back-large"
                        >
                            Back to Settings
                        </Button>
                    </div>
                </Container>
            </div>
        </div>
    );
}

export default App;

