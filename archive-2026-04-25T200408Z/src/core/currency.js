const CURRENCY_SYMBOLS = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    LTC: 'Ł'
};

const CURRENCY_NAMES = {
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    INR: 'Indian Rupee',
    LTC: 'Litecoin'
};

function normalizeCurrency(currency) {
    return String(currency || 'USD').trim().toUpperCase();
}

function getSymbol(currency) {
    const code = normalizeCurrency(currency);
    return CURRENCY_SYMBOLS[code] || code;
}

/**
 * Format a fiat amount with its currency symbol.
 * All supported currencies prefix the symbol (€100, $100, £100, ₹100).
 */
function formatFiat(amount, currency = 'USD') {
    const code = normalizeCurrency(currency);
    const symbol = CURRENCY_SYMBOLS[code] || code;
    const value = Number(amount || 0);

    if (code === 'LTC') {
        return `${value.toFixed(8)} Ł`;
    }

    // All fiat: symbol before number (€100, $100, £100, ₹100)
    return `${symbol}${value.toFixed(2)}`;
}

function formatFiatPerLtc(price, currency = 'USD') {
    return `${formatFiat(price, currency)}/LTC`;
}

// Legacy aliases
function formatEur(amount) {
    return formatFiat(amount, 'EUR');
}

function formatEurPerLtc(price) {
    return formatFiatPerLtc(price, 'EUR');
}

module.exports = {
    normalizeCurrency,
    getSymbol,
    formatFiat,
    formatFiatPerLtc,
    formatEur,
    formatEurPerLtc,
    CURRENCY_SYMBOLS,
    CURRENCY_NAMES
};
