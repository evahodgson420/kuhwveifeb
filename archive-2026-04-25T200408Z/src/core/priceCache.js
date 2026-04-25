/**
 * priceCache.js
 * Fetches and caches LTC prices in USD, EUR, GBP, INR every 60 seconds.
 * All other modules should read from this cache instead of calling CoinGecko directly.
 */

const axios = require('axios');

const CURRENCIES = ['usd', 'eur', 'gbp', 'inr'];
const REFRESH_INTERVAL_MS = 60_000;

// Default fallback prices
const prices = {
    usd: 85,
    eur: 78,
    gbp: 67,
    inr: 7100
};

let lastUpdated = null;
let refreshTimer = null;

async function fetchPrices() {
    try {
        const vs = CURRENCIES.join(',');
        const res = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=${vs}`,
            { timeout: 8000 }
        );
        const data = res.data?.litecoin;
        if (!data) return;

        for (const cur of CURRENCIES) {
            if (typeof data[cur] === 'number' && data[cur] > 0) {
                prices[cur] = data[cur];
            }
        }
        lastUpdated = new Date();
        console.log(`[PriceCache] Updated: ${CURRENCIES.map(c => `${c.toUpperCase()}=${prices[c]}`).join(' | ')}`);
    } catch (err) {
        console.error('[PriceCache] Fetch error:', err.message);
    }
}

/**
 * Start the background refresh loop. Safe to call multiple times.
 */
function startRefresh() {
    if (refreshTimer) return;
    fetchPrices(); // immediate first fetch
    refreshTimer = setInterval(fetchPrices, REFRESH_INTERVAL_MS);
}

/**
 * Get LTC price for a given currency code (case-insensitive).
 * Falls back to stored value if live data is unavailable.
 * @param {string} currency
 * @returns {number}
 */
function getPrice(currency = 'usd') {
    const key = String(currency).toLowerCase();
    return prices[key] ?? prices.usd ?? 85;
}

/**
 * Returns all cached prices as a plain object.
 */
function getAllPrices() {
    return { ...prices, lastUpdated };
}

module.exports = { startRefresh, getPrice, getAllPrices };
