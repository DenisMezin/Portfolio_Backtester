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

    // Carica i ticker disponibili all'avvio
    useEffect(() => {
        const fetchTickers = async () => {
            try {
                const response = await axios.get(TICKERS_URL);
                setAvailableTickers(response.data.all_tickers);
                setTickerCategories(response.data.categories);
            } catch (err) {
                console.error('Errore nel caricamento dei ticker:', err);
            }
        };
        fetchTickers();
    }, []);

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
            benchmark: benchmark.map(b => ({...b, weight: parseFloat(b.weight) || 0})).filter(b => b.name)
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

    const renderMetricRow = (metricName, portfolioValue, benchmarkValue) => (
        <tr key={metricName}>
            <td><strong>{metricName}</strong></td>
            <td>{(portfolioValue * 100).toFixed(2)}%</td>
            <td>{(benchmarkValue * 100).toFixed(2)}%</td>
        </tr>
    );

    return (
        <Container className="my-4">
            <Card className="shadow-sm">
                <Card.Header as="h1" className="text-center bg-dark text-white">Portfolio Backtesting Dashboard</Card.Header>
                <Card.Body>
                    <Form onSubmit={handleSubmit}>
                        <Row>
                            <Col md={6} className="p-3 border-end">
                                <h2>Il Tuo Portafoglio ETF</h2>
                                {etfs.map((etf, i) => (
                                    <Row key={i} className="mb-2 align-items-center">
                                        <Col>
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
                                        <Col><Form.Control type="number" name="weight" placeholder="Peso (es. 0.6)" value={etf.weight} onChange={e => handleInputChange(i, e, 'etf')} required step="0.01" min="0" /></Col>
                                    </Row>
                                ))}
                                <Button variant="outline-primary" size="sm" onClick={() => handleAddField('etf')}>+ Aggiungi ETF</Button>
                            </Col>
                            <Col md={6} className="p-3">
                                <h2>Benchmark</h2>
                                {benchmark.map((b, i) => (
                                    <Row key={i} className="mb-2 align-items-center">
                                        <Col>
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
                                        <Col><Form.Control type="number" name="weight" placeholder="Peso (es. 1.0)" value={b.weight} onChange={e => handleInputChange(i, e, 'benchmark')} required step="0.01" min="0" /></Col>
                                    </Row>
                                ))}
                                <Button variant="outline-secondary" size="sm" onClick={() => handleAddField('benchmark')}>+ Aggiungi Benchmark</Button>
                            </Col>
                        </Row>
                        <div className="text-center mt-4">
                            <Button type="submit" variant="primary" size="lg" disabled={loading}>
                                {loading ? <><Spinner as="span" animation="border" size="sm" /> Caricamento...</> : 'Avvia Backtest'}
                            </Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>

            {error && <Alert variant="danger" className="mt-4">{error}</Alert>}

            {results && (
                <Card className="mt-4 shadow-sm">
                    <Card.Header as="h2" className="text-center">Risultati Analisi</Card.Header>
                    <Card.Body>
                        <p className="text-center text-muted">Periodo di Analisi: <strong>{results.date_range.start}</strong> - <strong>{results.date_range.end}</strong></p>
                        <Row>
                            <Col md={12}>
                                <h3 className="text-center mb-3">Metriche di Performance</h3>
                                <Table striped bordered hover responsive className="text-center">
                                    <thead>
                                        <tr>
                                            <th>Metrica</th>
                                            <th>Portfolio</th>
                                            <th>Benchmark</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(results.metrics.portfolio).map(key =>
                                            renderMetricRow(key, results.metrics.portfolio[key], results.metrics.benchmark[key])
                                        )}
                                    </tbody>
                                </Table>
                            </Col>
                        </Row>
                        <div className="mt-4 text-center">
                            <h3>Grafico Performance</h3>
                            <img src={`data:image/png;base64,${results.plot}`} alt="Grafico Performance" className="img-fluid border rounded" />
                        </div>
                    </Card.Body>
                </Card>
            )}
        </Container>
    );
}

export default App;
