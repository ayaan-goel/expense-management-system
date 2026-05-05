const axios = require('axios');
const db = require('./database');

class CurrencyService {
  constructor() {
    this.restCountriesUrl = process.env.RESTCOUNTRIES_URL || 'https://restcountries.com/v3.1/all?fields=name,currencies';
    this.exchangeRateApiUrl = process.env.EXCHANGE_RATE_API_URL || 'https://api.exchangerate-api.com/v4/latest/';
    this.exchangeApiKey = process.env.EXCHANGE_API_KEY; // Optional for free tier
    
    // Cache settings
    this.cacheExpiryHours = 1;
  }

  /**
   * Get currency for a country code using RestCountries API
   * @param {string} countryCode - 2-letter country code (ISO 3166-1 alpha-2)
   * @returns {Promise<string>} - Currency code (e.g., 'USD', 'EUR')
   */
  async getCurrencyByCountryCode(countryCode) {
    try {
      console.log(`Fetching currency for country code: ${countryCode}`);
      
      const response = await axios.get(this.restCountriesUrl, {
        timeout: 10000 // 10 second timeout
      });

      const countries = response.data;
      const country = countries.find(c => 
        c.name && c.name.common && 
        c.name.common.toLowerCase() === this.getCountryNameByCode(countryCode).toLowerCase()
      );

      if (!country || !country.currencies) {
        console.warn(`Country not found or no currency data for: ${countryCode}`);
        return 'USD'; // Default to USD
      }

      // Get the first currency (most countries have only one)
      const currencyCode = Object.keys(country.currencies)[0];
      console.log(`Found currency: ${currencyCode} for country: ${countryCode}`);
      
      return currencyCode;
    } catch (error) {
      console.error('Error fetching currency from RestCountries:', error.message);
      // Return default currency on error
      return 'USD';
    }
  }

  /**
   * Get exchange rate between two currencies
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @returns {Promise<number>} - Exchange rate
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      // If same currency, return 1
      if (fromCurrency === toCurrency) {
        return 1.0;
      }

      // Check cache first
      const cachedRate = await this.getCachedExchangeRate(fromCurrency, toCurrency);
      if (cachedRate) {
        console.log(`Using cached exchange rate: ${fromCurrency} -> ${toCurrency} = ${cachedRate}`);
        return cachedRate;
      }

      // Fetch from API
      console.log(`Fetching exchange rate: ${fromCurrency} -> ${toCurrency}`);
      
      let apiUrl = `${this.exchangeRateApiUrl}${fromCurrency}`;
      if (this.exchangeApiKey) {
        apiUrl += `?access_key=${this.exchangeApiKey}`;
      }

      const response = await axios.get(apiUrl, {
        timeout: 10000 // 10 second timeout
      });

      if (!response.data || !response.data.rates || !response.data.rates[toCurrency]) {
        throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
      }

      const rate = response.data.rates[toCurrency];
      console.log(`Fetched exchange rate: ${fromCurrency} -> ${toCurrency} = ${rate}`);

      // Cache the rate
      await this.cacheExchangeRate(fromCurrency, toCurrency, rate);

      return rate;
    } catch (error) {
      console.error('Error fetching exchange rate:', error.message);
      
      // Try to get last known rate from cache (even if expired)
      const lastKnownRate = await this.getLastKnownExchangeRate(fromCurrency, toCurrency);
      if (lastKnownRate) {
        console.warn(`Using last known exchange rate: ${fromCurrency} -> ${toCurrency} = ${lastKnownRate}`);
        return lastKnownRate;
      }

      // As last resort, return 1 (assumes same value)
      console.error(`No exchange rate available for ${fromCurrency} -> ${toCurrency}, using 1.0`);
      return 1.0;
    }
  }

  /**
   * Convert amount from one currency to another
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Promise<{convertedAmount: number, exchangeRate: number}>}
   */
  async convertAmount(amount, fromCurrency, toCurrency) {
    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = parseFloat((amount * exchangeRate).toFixed(2));
    
    return {
      convertedAmount,
      exchangeRate,
      originalAmount: amount,
      fromCurrency,
      toCurrency
    };
  }

  /**
   * Get cached exchange rate if valid
   * @private
   */
  async getCachedExchangeRate(fromCurrency, toCurrency) {
    try {
      const cached = await db.get(
        `SELECT rate, expires_at FROM exchange_rates 
         WHERE base_currency = ? AND target_currency = ? AND expires_at > datetime('now')`,
        [fromCurrency, toCurrency]
      );

      return cached ? cached.rate : null;
    } catch (error) {
      console.error('Error getting cached exchange rate:', error);
      return null;
    }
  }

  /**
   * Cache exchange rate
   * @private
   */
  async cacheExchangeRate(fromCurrency, toCurrency, rate) {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.cacheExpiryHours);

      await db.run(
        `INSERT OR REPLACE INTO exchange_rates 
         (base_currency, target_currency, rate, cached_at, expires_at) 
         VALUES (?, ?, ?, datetime('now'), ?)`,
        [fromCurrency, toCurrency, rate, expiresAt.toISOString()]
      );

      console.log(`Cached exchange rate: ${fromCurrency} -> ${toCurrency} = ${rate}`);
    } catch (error) {
      console.error('Error caching exchange rate:', error);
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  /**
   * Get last known exchange rate (even if expired)
   * @private
   */
  async getLastKnownExchangeRate(fromCurrency, toCurrency) {
    try {
      const cached = await db.get(
        `SELECT rate FROM exchange_rates 
         WHERE base_currency = ? AND target_currency = ? 
         ORDER BY cached_at DESC LIMIT 1`,
        [fromCurrency, toCurrency]
      );

      return cached ? cached.rate : null;
    } catch (error) {
      console.error('Error getting last known exchange rate:', error);
      return null;
    }
  }

  /**
   * Simple mapping of country codes to country names
   * This is a basic implementation - could be extended or use a library
   * @private
   */
  getCountryNameByCode(countryCode) {
    const countryMap = {
      'US': 'United States',
      'GB': 'United Kingdom',
      'IN': 'India',
      'CA': 'Canada',
      'AU': 'Australia',
      'DE': 'Germany',
      'FR': 'France',
      'JP': 'Japan',
      'CN': 'China',
      'BR': 'Brazil'
      // Add more as needed
    };

    return countryMap[countryCode.toUpperCase()] || countryCode;
  }

  /**
   * Get list of supported currencies
   * @returns {Promise<Array>} - Array of currency codes
   */
  async getSupportedCurrencies() {
    try {
      const response = await axios.get(`${this.exchangeRateApiUrl}USD`, {
        timeout: 10000
      });

      if (response.data && response.data.rates) {
        return Object.keys(response.data.rates);
      }

      // Fallback to common currencies
      return ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'BRL'];
    } catch (error) {
      console.error('Error fetching supported currencies:', error);
      return ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'BRL'];
    }
  }

  /**
   * Clean up expired exchange rates
   */
  async cleanupExpiredRates() {
    try {
      const result = await db.run(
        "DELETE FROM exchange_rates WHERE expires_at < datetime('now')"
      );
      console.log(`Cleaned up ${result.changes} expired exchange rates`);
    } catch (error) {
      console.error('Error cleaning up expired rates:', error);
    }
  }
}

// Export singleton instance
module.exports = new CurrencyService();