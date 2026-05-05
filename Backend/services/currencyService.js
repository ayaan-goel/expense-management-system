const axios = require('axios');
const Database = require('sqlite3').Database;
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');
const CACHE_DURATION_HOURS = 1;

class CurrencyService {
  constructor() {
    this.restCountriesUrl = process.env.RESTCOUNTRIES_API_URL || 'https://restcountries.com/v3.1';
    this.exchangeRateUrl = process.env.EXCHANGERATE_API_URL || 'https://api.exchangerate-api.com/v4/latest';
  }

  /**
   * Get currency for a country using RestCountries API
   */
  async getCurrencyForCountry(countryCode) {
    try {
      const response = await axios.get(`${this.restCountriesUrl}/alpha/${countryCode}?fields=currencies`);
      const currencies = response.data.currencies;
      
      if (currencies && Object.keys(currencies).length > 0) {
        return Object.keys(currencies)[0]; // Return first currency code
      }
      
      return 'USD'; // Default fallback
    } catch (error) {
      console.warn(`Failed to get currency for country ${countryCode}:`, error.message);
      return 'USD'; // Default fallback
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
      return {
        convertedAmount: amount,
        exchangeRate: 1.0,
        fromCurrency,
        toCurrency
      };
    }

    try {
      // Check cache first
      const cachedRate = await this.getCachedRate(fromCurrency, toCurrency);
      if (cachedRate) {
        return {
          convertedAmount: Math.round((amount * cachedRate.rate) * 100) / 100,
          exchangeRate: cachedRate.rate,
          fromCurrency,
          toCurrency,
          cached: true
        };
      }

      // Fetch from API
      const rate = await this.fetchExchangeRate(fromCurrency, toCurrency);
      
      // Cache the rate
      await this.cacheRate(fromCurrency, toCurrency, rate);

      return {
        convertedAmount: Math.round((amount * rate) * 100) / 100,
        exchangeRate: rate,
        fromCurrency,
        toCurrency,
        cached: false
      };

    } catch (error) {
      console.error('Currency conversion error:', error.message);
      
      // Fallback: return original amount with rate 1
      return {
        convertedAmount: amount,
        exchangeRate: 1.0,
        fromCurrency,
        toCurrency,
        error: error.message
      };
    }
  }

  /**
   * Fetch exchange rate from external API
   */
  async fetchExchangeRate(fromCurrency, toCurrency) {
    try {
      const response = await axios.get(`${this.exchangeRateUrl}/${fromCurrency}`);
      const rates = response.data.rates;
      
      if (!rates[toCurrency]) {
        throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
      }
      
      return rates[toCurrency];
    } catch (error) {
      throw new Error(`Failed to fetch exchange rate: ${error.message}`);
    }
  }

  /**
   * Get cached exchange rate
   */
  getCachedRate(fromCurrency, toCurrency) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = `
        SELECT rate, cached_at 
        FROM exchange_rates 
        WHERE from_currency = ? AND to_currency = ?
        AND datetime(cached_at, '+${CACHE_DURATION_HOURS} hours') > datetime('now')
      `;
      
      db.get(sql, [fromCurrency, toCurrency], (err, row) => {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Cache exchange rate
   */
  cacheRate(fromCurrency, toCurrency, rate) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = `
        INSERT OR REPLACE INTO exchange_rates (from_currency, to_currency, rate, cached_at)
        VALUES (?, ?, ?, datetime('now'))
      `;
      
      db.run(sql, [fromCurrency, toCurrency, rate], function(err) {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Get list of supported currencies
   */
  async getSupportedCurrencies() {
    try {
      const response = await axios.get(`${this.exchangeRateUrl}/USD`);
      return Object.keys(response.data.rates).sort();
    } catch (error) {
      console.warn('Failed to get supported currencies:', error.message);
      // Return common currencies as fallback
      return ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR'];
    }
  }
}

module.exports = new CurrencyService();