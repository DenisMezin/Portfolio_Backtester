import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Spinner, Alert, Table } from 'react-bootstrap';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:8000/api/backtest';
const TICKERS_URL = 'http://localhost:8000/api/tickers';

function App() {
    const [etfs, setEtfs] = useState([{ name: 'VTI', weight: '0.6' }, { name: 'VXUS', weight: '0.4' }]);
    const [benchmark, setBenchmark] = useState([{ name: 'VT', weight: '1.0' }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState(null);
    const [availableTickers, setAvailableTickers] = useState([]);
    const [tickerCategories, setTickerCategories] = useState({});
    const [backendStatus, setBackendStatus] = useState('connecting');
    
    // Nuove configurazioni avanzate
    const [config, setConfig] = useState({
        start_date: '2010-01-01',
        end_date: new Date().toISOString().split('T')[0],
        initial_investment: 10000,
        rebalance_frequency: 'quarterly',
        transaction_cost: 0.001,
        reinvest_dividends: true
    });

    // Carica i ticker disponibili all'avvio e verifica connessione backend
    useEffect(() => {
        const checkBackendAndFetchTickers = async () => {
            try {
                // Verifica connessione backend
                await axios.get('http://localhost:8000/api/health');
                setBackendStatus('connected');
                
                // Carica ticker
                const response = await axios.get(TICKERS_URL);
                setAvailableTickers(response.data.all_tickers);
                setTickerCategories(response.data.categories);
            } catch (err) {
                console.error('Errore nel caricamento dei ticker o connessione backend:', err);
                setBackendStatus('disconnected');
            }
        };
        checkBackendAndFetchTickers();
    }, []);

    const portfolioPresets = {
        "Conservative": [
            { name: 'BND', weight: '0.6' },
            { name: 'VTI', weight: '0.3' },
            { name: 'VXUS', weight: '0.1' }
        ],
        "Balanced": [
            { name: 'VTI', weight: '0.6' },
            { name: 'VXUS', weight: '0.3' },
            { name: 'BND', weight: '0.1' }
        ],
        "Aggressive": [
            { name: 'VTI', weight: '0.7' },
            { name: 'VXUS', weight: '0.2' },
            { name: 'VB', weight: '0.1' }
        ],
        "Three Fund": [
            { name: 'VTI', weight: '0.6' },
            { name: 'VXUS', weight: '0.3' },
            { name: 'BND', weight: '0.1' }
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

    const handleRemoveField = (index, type) => {
        const list = type === 'etf' ? [...etfs] : [...benchmark];
        const setter = type === 'etf' ? setEtfs : setBenchmark;
        if (list.length > 1) {
            list.splice(index, 1);
            setter(list);
        }
    };

    const handleAddField = (type) => {
        const setter = type === 'etf' ? setEtfs : setBenchmark;
        const current = type === 'etf' ? etfs : benchmark;
        setter([...current, { name: '', weight: '' }]);
    };

    const handleInputChange = (index, event, type) => {
        const { name, value } = event.target;
        const list = type === 'etf' ? [...etfs] : [...benchmark];
        const setter = type === 'etf' ? setEtfs : setBenchmark;
        list[index][name] = value;
        setter(list);
    };
    
    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setResults(null);
        
        const payload = {
            etfs: etfs.map(e => ({...e, weight: parseFloat(e.weight) || 0})).filter(e => e.name),
            benchmark: benchmark.map(b => ({...b, weight: parseFloat(b.weight) || 0})).filter(b => b.name),
            config: {
                ...config,
                initial_investment: parseFloat(config.initial_investment),
                transaction_cost: parseFloat(config.transaction_cost)
            }
        };
        
        try {
            const response = await axios.post(API_URL, payload);
            setResults(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Errore durante l\'analisi. Assicurati che i ticker siano validi e il server sia attivo.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const exportResults = async () => {
        if (!results) return;
        
        const payload = {
            etfs: etfs.map(e => ({...e, weight: parseFloat(e.weight) || 0})).filter(e => e.name),
            benchmark: benchmark.map(b => ({...b, weight: parseFloat(b.weight) || 0})).filter(b => b.name),
            config: {
                ...config,
                initial_investment: parseFloat(config.initial_investment),
                transaction_cost: parseFloat(config.transaction_cost)
            }
        };
        
        try {
            const response = await axios.post('http://localhost:8000/api/export-csv', payload, {
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'backtest_results.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Errore nell\'export:', err);
        }
    };

    return (
        <Container className="my-4">
            {/* Indicatore stato backend */}
            <Alert variant={backendStatus === 'connected' ? 'success' : backendStatus === 'connecting' ? 'warning' : 'danger'} className="mb-3">
                <small>
                    <strong>Backend Status:</strong> 
                    {backendStatus === 'connected' && ' ✅ Connesso'}
                    {backendStatus === 'connecting' && ' ⏳ Connessione in corso...'}
                    {backendStatus === 'disconnected' && ' ❌ Disconnesso - Assicurati che il backend sia in esecuzione su porta 8000'}
                </small>
            </Alert>
            
            <Card className="shadow-sm">
                <Card.Header as="h1" className="text-center bg-dark text-white">Portfolio Backtesting Dashboard</Card.Header>
                <Card.Body>
                    <Form onSubmit={handleSubmit}>
                        {/* Configurazione Avanzata */}
                        <Card className="mb-4">
                            <Card.Header><h3>Configurazione Backtest</h3></Card.Header>
                            <Card.Body>
                                <Row>
                                    <Col md={3}>
                                        <Form.Group>
                                            <Form.Label>Data Inizio</Form.Label>
                                            <Form.Control 
                                                type="date" 
                                                name="start_date"
                                                value={config.start_date}
                                                onChange={handleConfigChange}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={3}>
                                        <Form.Group>
                                            <Form.Label>Data Fine</Form.Label>
                                            <Form.Control 
                                                type="date" 
                                                name="end_date"
                                                value={config.end_date}
                                                onChange={handleConfigChange}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={3}>
                                        <Form.Group>
                                            <Form.Label>Investimento Iniziale ($)</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                name="initial_investment"
                                                value={config.initial_investment}
                                                onChange={handleConfigChange}
                                                min="1000"
                                                step="1000"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={3}>
                                        <Form.Group>
                                            <Form.Label>Costi Transazione (%)</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                name="transaction_cost"
                                                value={config.transaction_cost}
                                                onChange={handleConfigChange}
                                                min="0"
                                                max="0.01"
                                                step="0.0001"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row className="mt-3">
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>Frequenza Ribilanciamento</Form.Label>
                                            <Form.Select 
                                                name="rebalance_frequency"
                                                value={config.rebalance_frequency}
                                                onChange={handleConfigChange}
                                            >
                                                <option value="none">Nessuno</option>
                                                <option value="monthly">Mensile</option>
                                                <option value="quarterly">Trimestrale</option>
                                                <option value="yearly">Annuale</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group className="d-flex align-items-center mt-4">
                                            <Form.Check 
                                                type="checkbox"
                                                name="reinvest_dividends"
                                                checked={config.reinvest_dividends}
                                                onChange={handleConfigChange}
                                                label="Reinvesti Dividendi"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>

                        <Row>
                            <Col md={6} className="p-3 border-end">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h2>Il Tuo Portafoglio ETF</h2>
                                    <div>
                                        <small className="text-muted me-2">Presets:</small>
                                        {Object.keys(portfolioPresets).map(preset => (
                                            <Button 
                                                key={preset}
                                                variant="outline-primary" 
                                                size="sm" 
                                                className="me-1 mb-1"
                                                onClick={() => loadPreset(preset)}
                                            >
                                                {preset}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                {etfs.map((etf, i) => (
                                    <Row key={i} className="mb-2 align-items-center">
                                        <Col sm={5}>
                                            <Form.Select 
                                                name="name" 
                                                value={etf.name} 
                                                onChange={e => handleInputChange(i, e, 'etf')} 
                                                required
                                            >
                                                <option value="">Seleziona un ticker...</option>
                                                {Object.entries(tickerCategories).map(([category, tickers]) => (
                                                    <optgroup key={category} label={category}>
                                                        {tickers.map(ticker => (
                                                            <option key={ticker} value={ticker}>{ticker}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </Form.Select>
                                        </Col>
                                        <Col sm={4}>
                                            <Form.Control 
                                                type="number" 
                                                name="weight" 
                                                placeholder="Peso (es. 0.6)" 
                                                value={etf.weight} 
                                                onChange={e => handleInputChange(i, e, 'etf')} 
                                                required 
                                                step="0.01" 
                                                min="0" 
                                            />
                                        </Col>
                                        <Col sm={3}>
                                            {etfs.length > 1 && (
                                                <Button 
                                                    variant="outline-danger" 
                                                    size="sm" 
                                                    onClick={() => handleRemoveField(i, 'etf')}
                                                >
                                                    Rimuovi
                                                </Button>
                                            )}
                                        </Col>
                                    </Row>
                                ))}
                                <Button variant="outline-primary" size="sm" onClick={() => handleAddField('etf')}>+ Aggiungi ETF</Button>
                            </Col>
                            <Col md={6} className="p-3">
                                <h2>Benchmark</h2>
                                {benchmark.map((b, i) => (
                                    <Row key={i} className="mb-2 align-items-center">
                                        <Col sm={5}>
                                            <Form.Select 
                                                name="name" 
                                                value={b.name} 
                                                onChange={e => handleInputChange(i, e, 'benchmark')} 
                                                required
                                            >
                                                <option value="">Seleziona un ticker...</option>
                                                {Object.entries(tickerCategories).map(([category, tickers]) => (
                                                    <optgroup key={category} label={category}>
                                                        {tickers.map(ticker => (
                                                            <option key={ticker} value={ticker}>{ticker}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </Form.Select>
                                        </Col>
                                        <Col sm={4}>
                                            <Form.Control 
                                                type="number" 
                                                name="weight" 
                                                placeholder="Peso (es. 1.0)" 
                                                value={b.weight} 
                                                onChange={e => handleInputChange(i, e, 'benchmark')} 
                                                required 
                                                step="0.01" 
                                                min="0" 
                                            />
                                        </Col>
                                        <Col sm={3}>
                                            {benchmark.length > 1 && (
                                                <Button 
                                                    variant="outline-danger" 
                                                    size="sm" 
                                                    onClick={() => handleRemoveField(i, 'benchmark')}
                                                >
                                                    Rimuovi
                                                </Button>
                                            )}
                                        </Col>
                                    </Row>
                                ))}
                                <Button variant="outline-secondary" size="sm" onClick={() => handleAddField('benchmark')}>+ Aggiungi Benchmark</Button>
                            </Col>
                        </Row>
                        <div className="text-center mt-4">
                            <Button type="submit" variant="primary" size="lg" disabled={loading || backendStatus !== 'connected'}>
                                {loading ? (
                                    <>
                                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                                        Elaborazione in corso...
                                        <br />
                                        <small>Scaricamento dati, calcolo metriche e generazione grafici...</small>
                                    </>
                                ) : (
                                    '🚀 Avvia Backtest Avanzato'
                                )}
                            </Button>
                            {backendStatus !== 'connected' && (
                                <div className="mt-2">
                                    <small className="text-danger">
                                        ⚠️ Backend non connesso. Avvia il server backend sulla porta 8000.
                                    </small>
                                </div>
                            )}
                        </div>
                    </Form>
                </Card.Body>
            </Card>

            {error && <Alert variant="danger" className="mt-4">{error}</Alert>}

            {results && (
                <Card className="mt-4 shadow-sm">
                    <Card.Header as="h2" className="text-center">
                        Risultati Analisi Avanzata
                        {results && (
                            <Button 
                                variant="outline-success" 
                                size="sm" 
                                className="float-end"
                                onClick={exportResults}
                            >
                                📁 Esporta CSV
                            </Button>
                        )}
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-4">
                            <Col md={6}>
                                <Alert variant="info">
                                    <strong>Periodo:</strong> {results.date_range.start} - {results.date_range.end}<br/>
                                    <strong>Investimento Iniziale:</strong> ${results.config.initial_investment.toLocaleString()}<br/>
                                    <strong>Ribilanciamento:</strong> {results.config.rebalance_frequency}
                                </Alert>
                            </Col>
                            <Col md={6}>
                                <Alert variant="success">
                                    <strong>Valore Finale Portfolio:</strong> ${results.final_values.portfolio.toLocaleString('en-US', {maximumFractionDigits: 0})}<br/>
                                    <strong>Valore Finale Benchmark:</strong> ${results.final_values.benchmark.toLocaleString('en-US', {maximumFractionDigits: 0})}<br/>
                                    <strong>Differenza:</strong> ${(results.final_values.portfolio - results.final_values.benchmark).toLocaleString('en-US', {maximumFractionDigits: 0})}
                                </Alert>
                            </Col>
                        </Row>
                        
                        <Row>
                            <Col md={12}>
                                <h3 className="text-center mb-3">Metriche di Performance Avanzate</h3>
                                <Table striped bordered hover responsive className="text-center performance-table">
                                    <thead>
                                        <tr>
                                            <th>Metrica</th>
                                            <th>Portfolio</th>
                                            <th>Benchmark</th>
                                            <th>Differenza</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(results.metrics.portfolio).map(key => {
                                            const portfolioValue = results.metrics.portfolio[key];
                                            const benchmarkValue = results.metrics.benchmark[key];
                                            const difference = portfolioValue - benchmarkValue;
                                            const isPercentage = !['Beta'].includes(key);
                                            
                                            return (
                                                <tr key={key}>
                                                    <td><strong>{key}</strong></td>
                                                    <td>{isPercentage ? (portfolioValue * 100).toFixed(2) + '%' : portfolioValue.toFixed(3)}</td>
                                                    <td>{isPercentage ? (benchmarkValue * 100).toFixed(2) + '%' : benchmarkValue.toFixed(3)}</td>
                                                    <td className={difference > 0 ? 'text-success' : difference < 0 ? 'text-danger' : ''}>
                                                        {isPercentage ? 
                                                            (difference > 0 ? '+' : '') + (difference * 100).toFixed(2) + '%' : 
                                                            (difference > 0 ? '+' : '') + difference.toFixed(3)
                                                        }
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            </Col>
                        </Row>
                        
                        <div className="mt-4">
                            <Row>
                                <Col md={12} className="text-center mb-4">
                                    <h3>Performance Cumulativa</h3>
                                    <img src={`data:image/png;base64,${results.plots.performance}`} alt="Grafico Performance" className="img-fluid border rounded" />
                                </Col>
                            </Row>
                            <Row>
                                <Col md={6} className="text-center mb-4">
                                    <h4>Drawdown del Portfolio</h4>
                                    <img src={`data:image/png;base64,${results.plots.drawdown}`} alt="Grafico Drawdown" className="img-fluid border rounded" />
                                </Col>
                                <Col md={6} className="text-center mb-4">
                                    <h4>Distribuzione Rendimenti Mensili</h4>
                                    <img src={`data:image/png;base64,${results.plots.distribution}`} alt="Distribuzione Rendimenti" className="img-fluid border rounded" />
                                </Col>
                            </Row>
                        </div>
                    </Card.Body>
                </Card>
            )}
        </Container>
    );
}

export default App;
