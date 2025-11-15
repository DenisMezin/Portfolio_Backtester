import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Spinner, Alert, Table, Tabs, Tab } from 'react-bootstrap';
import axios from 'axios';
import Plot from 'react-plotly.js';
import './App.css';

const API_URL = 'http://localhost:8000/api/backtest';
const TICKERS_URL = 'http://localhost:8000/api/tickers';

function App() {
    const [etfs, setEtfs] = useState([{ name: 'VTI', weight: '0.6', ter: '0.03' }, { name: 'VXUS', weight: '0.4', ter: '0.08' }]);
    const [benchmark, setBenchmark] = useState([{ name: 'VT', weight: '1.0', ter: '0.08' }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState(null);
    const [availableTickers, setAvailableTickers] = useState([]);
    const [tickerCategories, setTickerCategories] = useState({});
    const [backendStatus, setBackendStatus] = useState('connecting');
    
    // Efficient Frontier State
    const [efficientFrontierLoading, setEfficientFrontierLoading] = useState(false);
    const [efficientFrontierResults, setEfficientFrontierResults] = useState(null);
    const [efficientFrontierError, setEfficientFrontierError] = useState('');
    
    // Configurazioni avanzate
    const [config, setConfig] = useState({
        start_date: '1990-01-01',
        end_date: new Date().toISOString().split('T')[0],
        initial_investment: 10000,
        rebalance_frequency: 'quarterly',
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
        ],
        "Three Fund": [
            { name: 'VTI', weight: '0.6', ter: '0.03' },
            { name: 'VXUS', weight: '0.3', ter: '0.08' },
            { name: 'BND', weight: '0.1', ter: '0.03' }
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
        setter([...current, { name: '', weight: '', ter: '0.00' }]);
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
            etfs: etfs.map(e => ({...e, weight: parseFloat(e.weight) || 0, ter: parseFloat(e.ter) || 0})).filter(e => e.name),
            benchmark: benchmark.map(b => ({...b, weight: parseFloat(b.weight) || 0, ter: parseFloat(b.ter) || 0})).filter(b => b.name),
            config: {
                ...config,
                initial_investment: parseFloat(config.initial_investment)
            }
        };
        
        try {
            const response = await axios.post(API_URL, payload);
            setResults(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Errore nella richiesta di backtest');
            console.error('Errore:', err);
        } finally {
            setLoading(false);
        }
    };

    const runEfficientFrontier = async () => {
        setEfficientFrontierLoading(true);
        setEfficientFrontierError('');
        setEfficientFrontierResults(null);

        const etfList = etfs.map(e => ({
            name: e.name,
            weight: parseFloat(e.weight) || 0,
            ter: parseFloat(e.ter) || 0
        })).filter(e => e.name);

        if (etfList.length < 2) {
            setEfficientFrontierError('Sono necessari almeno 2 ETF per l\'analisi della frontiera efficiente');
            setEfficientFrontierLoading(false);
            return;
        }

        const payload = {
            etfs: etfList,
            config: {
                start_date: config.start_date,
                end_date: config.end_date,
                num_portfolios: 50000,
                risk_free_rate: 0.02,
                num_efficient_portfolios: 3
            }
        };

        try {
            const response = await axios.post('http://localhost:8000/api/efficient-frontier', payload);
            setEfficientFrontierResults(response.data);
        } catch (err) {
            setEfficientFrontierError(err.response?.data?.detail || 'Errore nell\'analisi della frontiera efficiente');
            console.error('Errore Efficient Frontier:', err);
        } finally {
            setEfficientFrontierLoading(false);
        }
    };

    const renderPlot = (plotData, title) => {
        if (!plotData) return null;
        
        // Se plotData è un oggetto Plotly, usa Plot
        if (plotData.data && plotData.layout) {
            return (
                <Plot
                    data={plotData.data}
                    layout={{
                        ...plotData.layout,
                        title: title,
                        autosize: true,
                        responsive: true
                    }}
                    config={{
                        displayModeBar: true,
                        displaylogo: false,
                        modeBarButtonsToRemove: ['pan2d', 'lasso2d']
                    }}
                    style={{ width: '100%', height: '400px' }}
                />
            );
        }
        
        // Altrimenti, è un'immagine base64
        return (
            <div className="text-center">
                <h4>{title}</h4>
                <img 
                    src={`data:image/png;base64,${plotData}`} 
                    alt={title} 
                    className="img-fluid border rounded"
                    style={{ maxHeight: '400px' }}
                />
            </div>
        );
    };

    return (
        <Container fluid className="py-4">
            {/* Status Backend */}
            {backendStatus === 'disconnected' && (
                <Alert variant="danger" className="mb-3">
                    <strong>⚠️ Backend non disponibile</strong> - Verifica che il server FastAPI sia in esecuzione su localhost:8000
                </Alert>
            )}
            
            <Card className="shadow-sm">
                <Card.Header as="h1" className="text-center bg-dark text-white">
                    Advanced Portfolio Backtesting Dashboard
                </Card.Header>
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
                                                <option value="monthly">Mensile</option>
                                                <option value="quarterly">Trimestrale</option>
                                                <option value="yearly">Annuale</option>
                                                <option value="none">Nessuno (Buy & Hold)</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={4} className="d-flex align-items-end">
                                        <Form.Check 
                                            type="checkbox"
                                            name="reinvest_dividends"
                                            label="Reinvestimento Dividendi"
                                            checked={config.reinvest_dividends}
                                            onChange={handleConfigChange}
                                        />
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>

                        {/* Portfolio Configuration */}
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
                                <Row className="mb-2">
                                    <Col sm={4}><small className="text-muted"><strong>Ticker ETF</strong></small></Col>
                                    <Col sm={3}><small className="text-muted"><strong>Peso</strong></small></Col>
                                    <Col sm={3}><small className="text-muted"><strong>TER (%)</strong></small></Col>
                                    <Col sm={2}><small className="text-muted"><strong>Azioni</strong></small></Col>
                                </Row>
                                {etfs.map((etf, i) => (
                                    <Row key={i} className="mb-2 align-items-center">
                                        <Col sm={4}>
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
                                        <Col sm={3}>
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
                                            <Form.Control 
                                                type="number" 
                                                name="ter" 
                                                placeholder="TER % (es. 0.03)" 
                                                value={etf.ter} 
                                                onChange={e => handleInputChange(i, e, 'etf')} 
                                                step="0.01" 
                                                min="0" 
                                                max="5.00"
                                            />
                                        </Col>
                                        <Col sm={2}>
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
                                <Row className="mb-2">
                                    <Col sm={4}><small className="text-muted"><strong>Ticker</strong></small></Col>
                                    <Col sm={3}><small className="text-muted"><strong>Peso</strong></small></Col>
                                    <Col sm={3}><small className="text-muted"><strong>TER (%)</strong></small></Col>
                                    <Col sm={2}><small className="text-muted"><strong>Azioni</strong></small></Col>
                                </Row>
                                {benchmark.map((b, i) => (
                                    <Row key={i} className="mb-2 align-items-center">
                                        <Col sm={4}>
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
                                        <Col sm={3}>
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
                                            <Form.Control 
                                                type="number" 
                                                name="ter" 
                                                placeholder="TER % (es. 0.08)" 
                                                value={b.ter} 
                                                onChange={e => handleInputChange(i, e, 'benchmark')} 
                                                step="0.01" 
                                                min="0" 
                                                max="5.00"
                                            />
                                        </Col>
                                        <Col sm={2}>
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
                            <Button type="submit" variant="primary" size="lg" disabled={loading || backendStatus !== 'connected'} className="me-3">
                                {loading ? (
                                    <>
                                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                                        Eseguendo Backtest...
                                    </>
                                ) : (
                                    'Esegui Backtest'
                                )}
                            </Button>
                            
                            <Button 
                                variant="outline-info" 
                                size="lg" 
                                disabled={efficientFrontierLoading || backendStatus !== 'connected'}
                                onClick={runEfficientFrontier}
                            >
                                {efficientFrontierLoading ? (
                                    <>
                                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                                        Calcolando...
                                    </>
                                ) : (
                                    'Genera Frontiera Efficiente'
                                )}
                            </Button>
                        </div>
                    </Form>

                    {error && (
                        <Alert variant="danger" className="mt-4">
                            {error}
                        </Alert>
                    )}

                    {/* Risultati Backtest con Grafici Interattivi */}
                    {results && (
                        <Card className="mt-4">
                            <Card.Header><h3 className="text-center">Risultati Backtest Avanzato</h3></Card.Header>
                            <Card.Body>
                                <Tabs defaultActiveKey="performance" className="mb-3">
                                    <Tab eventKey="performance" title="Performance">
                                        {renderPlot(results.plots?.performance, "Performance Cumulativa")}
                                    </Tab>
                                    
                                    <Tab eventKey="drawdown" title="Drawdown">
                                        {renderPlot(results.plots?.drawdown, "Portfolio Drawdown")}
                                    </Tab>
                                    
                                    <Tab eventKey="distribution" title="Distribuzione">
                                        {renderPlot(results.plots?.distribution, "Distribuzione Rendimenti")}
                                    </Tab>
                                    
                                    <Tab eventKey="allocation" title="Allocazione">
                                        {renderPlot(results.plots?.allocation, "Allocazione Portfolio")}
                                    </Tab>
                                    
                                    <Tab eventKey="metrics" title="Metriche">
                                        <Row>
                                            <Col md={6}>
                                                <h4 className="text-primary">Portfolio</h4>
                                                <Table striped bordered hover size="sm">
                                                    <tbody>
                                                        <tr>
                                                            <td><strong>Rendimento Annuale</strong></td>
                                                            <td className="text-success">{(results.metrics?.portfolio?.annual_return * 100).toFixed(2)}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>Volatilità Annuale</strong></td>
                                                            <td className="text-warning">{(results.metrics?.portfolio?.annual_volatility * 100).toFixed(2)}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>Sharpe Ratio</strong></td>
                                                            <td className="text-info">{results.metrics?.portfolio?.sharpe_ratio?.toFixed(3)}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>Max Drawdown</strong></td>
                                                            <td className="text-danger">{(results.metrics?.portfolio?.max_drawdown * 100).toFixed(2)}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>TER Totale</strong></td>
                                                            <td>{(results.config?.portfolio_ter * 100).toFixed(2)}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>Valore Finale</strong></td>
                                                            <td className="text-success">${results.final_values?.portfolio?.toLocaleString()}</td>
                                                        </tr>
                                                    </tbody>
                                                </Table>
                                            </Col>
                                            <Col md={6}>
                                                <h4 className="text-secondary">Benchmark</h4>
                                                <Table striped bordered hover size="sm">
                                                    <tbody>
                                                        <tr>
                                                            <td><strong>Rendimento Annuale</strong></td>
                                                            <td className="text-success">{(results.metrics?.benchmark?.annual_return * 100).toFixed(2)}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>Volatilità Annuale</strong></td>
                                                            <td className="text-warning">{(results.metrics?.benchmark?.annual_volatility * 100).toFixed(2)}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>Sharpe Ratio</strong></td>
                                                            <td className="text-info">{results.metrics?.benchmark?.sharpe_ratio?.toFixed(3)}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>Max Drawdown</strong></td>
                                                            <td className="text-danger">{(results.metrics?.benchmark?.max_drawdown * 100).toFixed(2)}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>TER Totale</strong></td>
                                                            <td>{(results.config?.benchmark_ter * 100).toFixed(2)}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td><strong>Valore Finale</strong></td>
                                                            <td className="text-success">${results.final_values?.benchmark?.toLocaleString()}</td>
                                                        </tr>
                                                    </tbody>
                                                </Table>
                                            </Col>
                                        </Row>
                                    </Tab>
                                </Tabs>
                            </Card.Body>
                        </Card>
                    )}

                    {/* Efficient Frontier Results */}
                    {efficientFrontierError && (
                        <Alert variant="danger" className="mt-3">
                            {efficientFrontierError}
                        </Alert>
                    )}

                    {efficientFrontierResults && (
                        <Card className="mt-4">
                            <Card.Header><h3 className="text-center">Risultati Frontiera Efficiente</h3></Card.Header>
                            <Card.Body>
                                <Row className="mb-4">
                                    <Col md={12} className="text-center">
                                        <h4>Frontiera Efficiente</h4>
                                        <img 
                                            src={`data:image/png;base64,${efficientFrontierResults.plots.efficient_frontier}`} 
                                            alt="Frontiera Efficiente" 
                                            className="img-fluid border rounded"
                                            style={{maxHeight: '600px'}}
                                        />
                                    </Col>
                                </Row>

                                {efficientFrontierResults.plots.portfolio_compositions && (
                                    <Row className="mb-4">
                                        <Col md={12} className="text-center">
                                            <h4>Composizione Portafogli Ottimali</h4>
                                            <img 
                                                src={`data:image/png;base64,${efficientFrontierResults.plots.portfolio_compositions}`} 
                                                alt="Composizione Portafogli" 
                                                className="img-fluid border rounded"
                                                style={{maxHeight: '800px'}}
                                            />
                                        </Col>
                                    </Row>
                                )}

                                <Row>
                                    <Col md={12}>
                                        <h4 className="text-center mb-3">Portafogli Ottimali</h4>
                                        <Table striped bordered hover responsive className="text-center">
                                            <thead>
                                                <tr>
                                                    <th>Portfolio</th>
                                                    <th>Rendimento Annuo</th>
                                                    <th>Volatilità Annua</th>
                                                    <th>Sharpe Ratio</th>
                                                    <th>Allocazione</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {efficientFrontierResults.portfolios.map((portfolio, index) => (
                                                    <tr key={index}>
                                                        <td><strong>{portfolio.name}</strong></td>
                                                        <td className="text-success">
                                                            {(portfolio.annual_return * 100).toFixed(2)}%
                                                        </td>
                                                        <td className="text-warning">
                                                            {(portfolio.annual_volatility * 100).toFixed(2)}%
                                                        </td>
                                                        <td className="text-info">
                                                            {portfolio.sharpe_ratio.toFixed(3)}
                                                        </td>
                                                        <td>
                                                            <small>
                                                                {Object.entries(portfolio.weights)
                                                                    .filter(([_, weight]) => weight >= 0.05)
                                                                    .map(([asset, weight]) => 
                                                                        `${asset}: ${(weight * 100).toFixed(1)}%`
                                                                    ).join(', ')}
                                                            </small>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    )}
                </Card.Body>
            </Card>

        </Container>
    );
}

export default App;

