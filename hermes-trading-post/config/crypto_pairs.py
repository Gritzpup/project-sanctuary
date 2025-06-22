"""
Cryptocurrency Trading Pairs Configuration
Defines available trading pairs and their metadata
"""

# Popular cryptocurrency trading pairs for backtesting and live trading
CRYPTO_PAIRS = {
    # Major Cryptocurrencies
    'BTC-USD': {
        'name': 'Bitcoin',
        'symbol': 'BTC',
        'base_currency': 'BTC',
        'quote_currency': 'USD',
        'min_order_size': 0.0001,
        'price_precision': 2,
        'size_precision': 8,
        'category': 'major'
    },
    'ETH-USD': {
        'name': 'Ethereum',
        'symbol': 'ETH',
        'base_currency': 'ETH',
        'quote_currency': 'USD',
        'min_order_size': 0.001,
        'price_precision': 2,
        'size_precision': 6,
        'category': 'major'
    },
    
    # Layer 1 Blockchains
    'SOL-USD': {
        'name': 'Solana',
        'symbol': 'SOL',
        'base_currency': 'SOL',
        'quote_currency': 'USD',
        'min_order_size': 0.01,
        'price_precision': 2,
        'size_precision': 4,
        'category': 'layer1'
    },
    'ADA-USD': {
        'name': 'Cardano',
        'symbol': 'ADA',
        'base_currency': 'ADA',
        'quote_currency': 'USD',
        'min_order_size': 1.0,
        'price_precision': 4,
        'size_precision': 2,
        'category': 'layer1'
    },
    'AVAX-USD': {
        'name': 'Avalanche',
        'symbol': 'AVAX',
        'base_currency': 'AVAX',
        'quote_currency': 'USD',
        'min_order_size': 0.01,
        'price_precision': 2,
        'size_precision': 4,
        'category': 'layer1'
    },
    'DOT-USD': {
        'name': 'Polkadot',
        'symbol': 'DOT',
        'base_currency': 'DOT',
        'quote_currency': 'USD',
        'min_order_size': 0.1,
        'price_precision': 2,
        'size_precision': 3,
        'category': 'layer1'
    },
    
    # DeFi and Utility Tokens
    'LINK-USD': {
        'name': 'Chainlink',
        'symbol': 'LINK',
        'base_currency': 'LINK',
        'quote_currency': 'USD',
        'min_order_size': 0.1,
        'price_precision': 2,
        'size_precision': 3,
        'category': 'defi'
    },
    'MATIC-USD': {
        'name': 'Polygon',
        'symbol': 'MATIC',
        'base_currency': 'MATIC',
        'quote_currency': 'USD',
        'min_order_size': 1.0,
        'price_precision': 4,
        'size_precision': 2,
        'category': 'layer2'
    },
    
    # Meme Coins (Popular for trading)
    'DOGE-USD': {
        'name': 'Dogecoin',
        'symbol': 'DOGE',
        'base_currency': 'DOGE',
        'quote_currency': 'USD',
        'min_order_size': 10.0,
        'price_precision': 4,
        'size_precision': 1,
        'category': 'meme'
    },
    'SHIB-USD': {
        'name': 'Shiba Inu',
        'symbol': 'SHIB',
        'base_currency': 'SHIB',
        'quote_currency': 'USD',
        'min_order_size': 100000.0,
        'price_precision': 8,
        'size_precision': 0,
        'category': 'meme'
    }
}

# Granularity options for historical data (in seconds)
GRANULARITY_OPTIONS = {
    '1m': 60,      # 1 minute
    '5m': 300,     # 5 minutes
    '15m': 900,    # 15 minutes
    '1h': 3600,    # 1 hour
    '6h': 21600,   # 6 hours
    '1d': 86400    # 1 day
}

# Coinbase Advanced Trade API granularity enum values
COINBASE_GRANULARITY = {
    '1m': 'ONE_MINUTE',
    '5m': 'FIVE_MINUTE', 
    '15m': 'FIFTEEN_MINUTE',
    '1h': 'ONE_HOUR',
    '6h': 'SIX_HOUR',
    '1d': 'ONE_DAY'
}

def get_pair_info(pair_id: str) -> dict:
    """Get information about a specific trading pair"""
    return CRYPTO_PAIRS.get(pair_id, {})

def get_pairs_by_category(category: str) -> list:
    """Get all trading pairs in a specific category"""
    return [
        pair_id for pair_id, info in CRYPTO_PAIRS.items() 
        if info.get('category') == category
    ]

def get_all_pairs() -> list:
    """Get all available trading pairs"""
    return list(CRYPTO_PAIRS.keys())

def get_major_pairs() -> list:
    """Get major cryptocurrency pairs (BTC, ETH)"""
    return get_pairs_by_category('major')

def get_default_pairs() -> list:
    """Get default pairs for the dashboard"""
    return ['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD']
