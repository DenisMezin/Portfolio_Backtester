import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import yfinance as yf
from typing import List
from pydantic import BaseModel
from fastapi import HTTPException
import io
import base64


class EtfInput(BaseModel):
    name: str
    weight: float
    ter: float = 0.0  # Total Expense Ratio (%) annuale


class EfficientFrontierConfig(BaseModel):
    start_date: str = "2010-01-01"
    end_date: str = "2024-12-31"
    num_portfolios: int = 100000
    risk_free_rate: float = 0.02
    num_efficient_portfolios: int = 3


def fig_to_base64(fig):
    """Convert matplotlib figure to base64 string."""
    img_buffer = io.BytesIO()
    fig.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
    img_buffer.seek(0)
    img_str = base64.b64encode(img_buffer.getvalue()).decode()
    plt.close(fig)
    return img_str


def load_etf_data(etfs: List[EtfInput], start_date: str, end_date: str) -> pd.DataFrame:
    """Load and process ETF data for efficient frontier analysis."""
    tickers = [etf.name for etf in etfs]
    
    try:
        # Download data for all tickers
        data = yf.download(tickers, start=start_date, end=end_date, progress=False)
        if data.empty:
            raise ValueError("No data downloaded. Check tickers.")
        
        # Handle both single and multiple ticker cases
        if len(tickers) == 1:
            adj_close = data[['Close']].rename(columns={'Close': tickers[0]})
        else:
            adj_close = data['Close']
        
        return adj_close.dropna(how='all')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error loading data: {e}")


def calculate_efficient_frontier(etfs: List[EtfInput], config: EfficientFrontierConfig):
    """Calculate efficient frontier and return analysis results."""
    
    # Load ETF data
    all_normalized_assets_ef = load_etf_data(etfs, config.start_date, config.end_date)
    
    if all_normalized_assets_ef.empty:
        raise HTTPException(status_code=400, detail="No data available for the specified period")
    
    # Extract monthly returns for all columns
    monthly_returns = all_normalized_assets_ef.pct_change().dropna()
    symbols = monthly_returns.columns
    
    if len(symbols) < 2:
        raise HTTPException(status_code=400, detail="At least 2 assets are required for efficient frontier analysis")
    
    n_months = len(monthly_returns)
    annual_returns = (1 + monthly_returns).prod() ** (12 / n_months) - 1
    
    # Applica TER (fee annuali) ai rendimenti degli ETF
    etf_ter_dict = {etf.name: etf.ter for etf in etfs}
    for symbol in symbols:
        ter = etf_ter_dict.get(symbol, 0.0) / 100  # Converti percentuale in decimale
        annual_returns[symbol] -= ter  # Sottrai TER annuale dai rendimenti
    
    # Use annual returns for CAGR (net of fees)
    cagr = annual_returns
    
    # Calculate the annualized covariance matrix
    cov_matrix = monthly_returns.cov() * 12
    
    # Randomly generate weights for the portfolios
    weights = np.random.random((config.num_portfolios, len(symbols)))
    weights /= weights.sum(axis=1, keepdims=True)
    
    # Calculate portfolio returns and std
    portfolio_returns = np.dot(weights, cagr)
    portfolio_std_devs = np.sqrt(np.einsum('ij,ji->i', weights.dot(cov_matrix), weights.T))
    
    # Calculate Sharpe Ratios
    sharpe_ratios = (portfolio_returns - config.risk_free_rate) / portfolio_std_devs
    
    # Find key portfolios
    max_sharpe_idx = np.argmax(sharpe_ratios)
    max_return_idx = np.argmax(portfolio_returns)
    min_std_dev_idx = np.argmin(portfolio_std_devs)
    
    # Create a DataFrame to store the results
    results_df = pd.DataFrame({
        'Annual Return': portfolio_returns,
        'Annual Volatility': portfolio_std_devs,
        'Sharpe Ratio': sharpe_ratios
    })
    
    # Add the weights to the DataFrame
    for i, symbol in enumerate(symbols):
        results_df[f'{symbol} Weight'] = weights[:, i]
    
    # Sorting portfolios by volatility
    sorted_results_df = results_df.sort_values(by='Annual Volatility').reset_index(drop=True)
    
    # Function to find the portfolio with maximum return for a given volatility
    def max_return_for_volatility(df, volatility):
        df_at_vol = df[df['Annual Volatility'] <= volatility]
        if df_at_vol.empty:
            return df.loc[df['Annual Return'].idxmax()]
        return df_at_vol.loc[df_at_vol['Annual Return'].idxmax()]
    
    # Find efficient portfolios
    efficient_portfolios = []
    min_vol = sorted_results_df['Annual Volatility'].min()
    max_vol = sorted_results_df['Annual Volatility'].max()
    vol_range = np.linspace(min_vol, max_vol, config.num_efficient_portfolios + 2)[1:-1]
    
    for vol in vol_range:
        efficient_portfolios.append(max_return_for_volatility(sorted_results_df, vol))
    
    # Key portfolios
    key_portfolios = [
        results_df.iloc[max_sharpe_idx],
        results_df.iloc[min_std_dev_idx],
        results_df.iloc[max_return_idx]
    ]
    
    all_model_portfolios = pd.DataFrame(efficient_portfolios + key_portfolios).reset_index(drop=True)
    portfolio_names = [f'Efficient {i+1}' for i in range(config.num_efficient_portfolios)] + ['Max Sharpe', 'Min Volatility', 'Max Return']
    all_model_portfolios['Portfolio'] = portfolio_names
    
    # Generate plots
    plots = generate_plots(results_df, all_model_portfolios, symbols)
    
    # Prepare portfolio data for frontend
    portfolios_data = []
    weight_columns = [col for col in all_model_portfolios.columns if 'Weight' in col]
    
    for _, portfolio in all_model_portfolios.iterrows():
        portfolio_dict = {
            'name': portfolio['Portfolio'],
            'annual_return': float(portfolio['Annual Return']),
            'annual_volatility': float(portfolio['Annual Volatility']),
            'sharpe_ratio': float(portfolio['Sharpe Ratio']),
            'weights': {}
        }
        
        for col in weight_columns:
            asset_name = col.replace(' Weight', '')
            portfolio_dict['weights'][asset_name] = float(portfolio[col])
        
        portfolios_data.append(portfolio_dict)
    
    return {
        'portfolios': portfolios_data,
        'plots': plots,
        'config': {
            'start_date': config.start_date,
            'end_date': config.end_date,
            'num_portfolios': config.num_portfolios,
            'risk_free_rate': config.risk_free_rate,
            'assets': list(symbols)
        }
    }


def generate_plots(results_df, all_model_portfolios, symbols):
    """Generate visualization plots for efficient frontier analysis."""
    plots = {}
    
    # Plot 1: Efficient Frontier
    plt.style.use('default')
    fig1, ax1 = plt.subplots(figsize=(12, 8))
    scatter = ax1.scatter(results_df['Annual Volatility'], results_df['Annual Return'], 
                         c=results_df['Sharpe Ratio'], cmap='viridis', alpha=0.6, s=1)
    plt.colorbar(scatter, label='Sharpe Ratio')
    
    colors = ['red', 'blue', 'green', 'purple', 'orange', 'black']
    markers = ['o', 'o', 'o', 'X', 'X', 'X']
    
    for i, (_, portfolio) in enumerate(all_model_portfolios.iterrows()):
        ax1.scatter(portfolio['Annual Volatility'], portfolio['Annual Return'], 
                   color=colors[i % len(colors)], marker=markers[i % len(markers)], 
                   s=100, label=portfolio['Portfolio'], edgecolors='white', linewidth=1)
    
    ax1.set_xlabel('Annual Volatility', fontsize=12)
    ax1.set_ylabel('Annual Return', fontsize=12)
    ax1.set_title('Efficient Frontier with Model Portfolios', fontsize=14)
    ax1.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    ax1.grid(True, alpha=0.3)
    plt.tight_layout()
    
    plots['efficient_frontier'] = fig_to_base64(fig1)
    
    # Plot 2: Portfolio Compositions
    weight_columns = [col for col in all_model_portfolios.columns if 'Weight' in col]
    
    if len(weight_columns) > 0:
        fig2, axes = plt.subplots(2, 3, figsize=(18, 12))
        axes = axes.flatten()
        
        # Get asset names
        all_assets = [col.replace(' Weight', '') for col in weight_columns]
        
        # Define color map for consistency
        color_map = plt.cm.get_cmap('tab20')
        color_dict = {asset: color_map(i / len(all_assets)) for i, asset in enumerate(all_assets)}
        
        # Plot each portfolio's composition
        for i, (_, portfolio) in enumerate(all_model_portfolios.iterrows()):
            if i >= len(axes):
                break
            
            weights = portfolio[weight_columns]
            
            # Filter out positions smaller than 5%
            significant_weights = weights[weights >= 0.05]
            
            # Rescale to make remaining weights sum to 1
            if len(significant_weights) > 0 and significant_weights.sum() < 1:
                scaling_factor = 1 / significant_weights.sum()
                significant_weights *= scaling_factor
            
            if len(significant_weights) == 0:
                continue
                
            labels = significant_weights.index.str.replace(' Weight', '')
            colors = [color_dict.get(label, 'gray') for label in labels]
            
            ax = axes[i]
            
            # Plot pie chart
            wedges, _, autotexts = ax.pie(
                significant_weights,
                labels=None,
                autopct='%1.1f%%',
                colors=colors,
                startangle=90
            )
            
            # Set title with return and volatility
            ax.set_title(
                f"{portfolio['Portfolio']}\n"
                f"Return: {portfolio['Annual Return']:.2%}\n"
                f"Volatility: {portfolio['Annual Volatility']:.2%}",
                fontsize=10
            )
            
            # Create legend
            legend_labels = [
                f"{label} ({weight:.1%})"
                for label, weight in zip(labels, significant_weights)
            ]
            ax.legend(
                wedges,
                legend_labels,
                title="Assets",
                loc="center left",
                bbox_to_anchor=(1, 0, 0.5, 1),
                fontsize=8
            )
        
        # Hide unused subplot axes
        for j in range(len(all_model_portfolios), len(axes)):
            fig2.delaxes(axes[j])
        
        # Add global title
        plt.suptitle(
            "Asset Allocation of Model Portfolios (Positions ≥ 5%, Redistributed)",
            fontsize=16
        )
        plt.tight_layout()
        plt.subplots_adjust(top=0.9)
        
        plots['portfolio_compositions'] = fig_to_base64(fig2)
    
    return plots