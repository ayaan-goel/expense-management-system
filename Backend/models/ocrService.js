const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const db = require('./database');

class OCRService {
  constructor() {
    this.confidence_threshold = 60; // Minimum confidence for accepting OCR results
  }

  /**
   * Process receipt image/PDF and extract expense data
   * @param {string} filePath - Path to the uploaded file
   * @param {number|null} expenseId - Optional expense ID to link results
   * @returns {Promise<Object>} - Parsed expense data
   */
  async parseReceipt(filePath, expenseId = null) {
    try {
      console.log(`Starting OCR processing for file: ${filePath}`);
      
      // Store initial OCR record
      const ocrResult = await db.run(
        'INSERT INTO ocr_results (expense_id, file_path, parsed_fields, processing_status) VALUES (?, ?, ?, ?)',
        [expenseId, filePath, JSON.stringify({}), 'pending']
      );

      const ocrId = ocrResult.id;

      try {
        // Perform OCR
        const { data } = await Tesseract.recognize(filePath, 'eng', {
          logger: m => console.log(`OCR Progress: ${m.status} - ${m.progress}`)
        });

        console.log(`OCR Text extracted (confidence: ${data.confidence}%):`, data.text);

        // Parse the extracted text
        const parsedData = this.parseReceiptText(data.text, data.confidence);
        
        // Update OCR results
        await db.run(
          'UPDATE ocr_results SET parsed_fields = ?, confidence_score = ?, processing_status = ? WHERE id = ?',
          [JSON.stringify(parsedData), data.confidence, 'completed', ocrId]
        );

        console.log('OCR processing completed successfully');
        
        return {
          success: true,
          ocrId,
          confidence: data.confidence,
          parsedData,
          rawText: data.text
        };

      } catch (ocrError) {
        console.error('OCR processing failed:', ocrError);
        
        // Update OCR record with failure status
        await db.run(
          'UPDATE ocr_results SET processing_status = ? WHERE id = ?',
          ['failed', ocrId]
        );

        throw ocrError;
      }

    } catch (error) {
      console.error('OCR service error:', error);
      throw error;
    }
  }

  /**
   * Parse extracted text to identify expense components
   * @private
   */
  parseReceiptText(text, confidence) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const parsedData = {
      vendor: null,
      amount: null,
      date: null,
      category: null,
      lineItems: [],
      currency: 'USD', // Default, could be enhanced to detect currency
      confidence_details: {
        overall: confidence,
        vendor: 0,
        amount: 0,
        date: 0
      }
    };

    // Extract vendor/merchant name (usually first few non-date/amount lines)
    parsedData.vendor = this.extractVendor(lines);
    parsedData.confidence_details.vendor = parsedData.vendor ? 80 : 0;

    // Extract amount (look for currency symbols and number patterns)
    const amountInfo = this.extractAmount(lines);
    parsedData.amount = amountInfo.amount;
    parsedData.currency = amountInfo.currency;
    parsedData.confidence_details.amount = amountInfo.confidence;

    // Extract date
    const dateInfo = this.extractDate(lines);
    parsedData.date = dateInfo.date;
    parsedData.confidence_details.date = dateInfo.confidence;

    // Extract line items
    parsedData.lineItems = this.extractLineItems(lines);

    // Determine category based on vendor name or content
    parsedData.category = this.determineCategory(parsedData.vendor, lines);

    return parsedData;
  }

  /**
   * Extract vendor/merchant name
   * @private
   */
  extractVendor(lines) {
    // Look for common merchant indicators
    const merchantKeywords = ['restaurant', 'hotel', 'store', 'shop', 'market', 'cafe', 'bar'];
    
    // Usually the vendor name is in the first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].toLowerCase();
      
      // Skip lines that look like addresses, dates, or amounts
      if (this.isAmount(line) || this.isDate(line) || this.isAddress(line)) {
        continue;
      }
      
      // If line contains merchant keywords or looks like a business name
      if (merchantKeywords.some(keyword => line.includes(keyword)) || 
          (lines[i].length > 3 && lines[i].length < 50)) {
        return lines[i];
      }
    }

    // Fallback: return first non-empty line that's not a date/amount
    for (const line of lines.slice(0, 3)) {
      if (line.length > 2 && !this.isAmount(line) && !this.isDate(line)) {
        return line;
      }
    }

    return null;
  }

  /**
   * Extract amount from text lines
   * @private
   */
  extractAmount(lines) {
    const amounts = [];
    const currencySymbols = ['$', '€', '£', '¥', '₹', 'USD', 'EUR', 'GBP', 'INR'];
    
    for (const line of lines) {
      // Look for patterns like $12.34, 12.34, USD 12.34, etc.
      const amountMatches = line.match(/(?:[$€£¥₹]|USD|EUR|GBP|INR)?\s*(\d{1,6}(?:[.,]\d{2})?)\s*(?:USD|EUR|GBP|INR)?/gi);
      
      if (amountMatches) {
        for (const match of amountMatches) {
          const numMatch = match.match(/(\d{1,6}(?:[.,]\d{2})?)/);
          if (numMatch) {
            const amount = parseFloat(numMatch[1].replace(',', '.'));
            if (amount > 0 && amount < 100000) { // Reasonable amount range
              amounts.push({
                amount,
                currency: this.extractCurrency(match) || 'USD',
                confidence: 90,
                original: match.trim()
              });
            }
          }
        }
      }
    }

    // Return the largest amount found (likely the total)
    if (amounts.length > 0) {
      amounts.sort((a, b) => b.amount - a.amount);
      return amounts[0];
    }

    return { amount: null, currency: 'USD', confidence: 0 };
  }

  /**
   * Extract currency from amount string
   * @private
   */
  extractCurrency(amountString) {
    const currencyMap = {
      '$': 'USD',
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY',
      '₹': 'INR'
    };

    for (const [symbol, code] of Object.entries(currencyMap)) {
      if (amountString.includes(symbol)) {
        return code;
      }
    }

    // Check for currency codes
    const currencyCodes = ['USD', 'EUR', 'GBP', 'JPY', 'INR'];
    for (const code of currencyCodes) {
      if (amountString.toUpperCase().includes(code)) {
        return code;
      }
    }

    return null;
  }

  /**
   * Extract date from text lines
   * @private
   */
  extractDate(lines) {
    for (const line of lines) {
      // Common date patterns
      const datePatterns = [
        /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/,  // MM/DD/YYYY, DD/MM/YYYY
        /(\d{2,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,  // YYYY/MM/DD
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})/i, // DD Mon YYYY
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{2,4})/i  // Mon DD, YYYY
      ];

      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          try {
            let date;
            if (pattern.source.includes('Jan|Feb')) {
              // Handle month name patterns
              date = new Date(match[0]);
            } else {
              // Handle numeric patterns - assume MM/DD/YYYY for US format
              const parts = match.slice(1);
              if (parts[2].length === 2) parts[2] = '20' + parts[2]; // Convert YY to YYYY
              date = new Date(parts[2], parts[0] - 1, parts[1]); // YYYY, MM-1, DD
            }

            if (date && !isNaN(date.getTime())) {
              return {
                date: date.toISOString().split('T')[0], // YYYY-MM-DD format
                confidence: 85
              };
            }
          } catch (error) {
            continue;
          }
        }
      }
    }

    return { date: null, confidence: 0 };
  }

  /**
   * Extract line items from receipt
   * @private
   */
  extractLineItems(lines) {
    const items = [];
    
    for (const line of lines) {
      // Look for lines that might be items (contain both text and amounts)
      if (line.length > 5 && this.hasAmount(line) && !this.isHeaderOrFooter(line)) {
        const amountMatch = line.match(/(\d+(?:\.\d{2})?)\s*$/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1]);
          const description = line.replace(/\s*\d+(?:\.\d{2})?\s*$/, '').trim();
          
          if (description.length > 2 && amount > 0) {
            items.push({
              description,
              amount,
              quantity: 1 // Could be enhanced to detect quantity
            });
          }
        }
      }
    }

    return items;
  }

  /**
   * Determine expense category based on vendor and content
   * @private
   */
  determineCategory(vendor, lines) {
    const allText = (vendor || '').toLowerCase() + ' ' + lines.join(' ').toLowerCase();
    
    const categoryKeywords = {
      'Food': ['restaurant', 'cafe', 'bar', 'food', 'dining', 'pizza', 'burger', 'coffee'],
      'Transportation': ['taxi', 'uber', 'lyft', 'gas', 'fuel', 'parking', 'toll', 'metro', 'bus'],
      'Accommodation': ['hotel', 'motel', 'inn', 'resort', 'lodging', 'accommodation'],
      'Office Supplies': ['office', 'supplies', 'paper', 'pen', 'staples', 'print'],
      'Entertainment': ['movie', 'theater', 'cinema', 'entertainment', 'show'],
      'Healthcare': ['pharmacy', 'medical', 'doctor', 'hospital', 'clinic'],
      'Technology': ['computer', 'software', 'electronics', 'tech', 'laptop']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        return category;
      }
    }

    return 'Other';
  }

  /**
   * Helper method to check if a line contains an amount
   * @private
   */
  hasAmount(line) {
    return /\d+(?:\.\d{2})?/.test(line);
  }

  /**
   * Helper method to check if a line is an amount
   * @private
   */
  isAmount(line) {
    return /^[\s$€£¥₹]*\d+(?:[.,]\d{2})?[\s$€£¥₹]*$/i.test(line);
  }

  /**
   * Helper method to check if a line is a date
   * @private
   */
  isDate(line) {
    return /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line) || 
           /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(line);
  }

  /**
   * Helper method to check if a line looks like an address
   * @private
   */
  isAddress(line) {
    return /\d+\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive)/i.test(line) ||
           /\d{5}(\-\d{4})?/.test(line); // ZIP code
  }

  /**
   * Helper method to check if a line is header/footer content
   * @private
   */
  isHeaderOrFooter(line) {
    const headerFooterKeywords = ['thank you', 'receipt', 'total', 'subtotal', 'tax', 'tip', 'change'];
    const lowerLine = line.toLowerCase();
    return headerFooterKeywords.some(keyword => lowerLine.includes(keyword));
  }

  /**
   * Get OCR results by ID
   */
  async getOCRResult(ocrId) {
    try {
      const result = await db.get(
        'SELECT * FROM ocr_results WHERE id = ?',
        [ocrId]
      );

      if (result) {
        result.parsed_fields = JSON.parse(result.parsed_fields);
      }

      return result;
    } catch (error) {
      console.error('Error getting OCR result:', error);
      throw error;
    }
  }

  /**
   * Clean up old OCR files and records
   */
  async cleanup(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Get old OCR records
      const oldRecords = await db.all(
        'SELECT id, file_path FROM ocr_results WHERE created_at < ?',
        [cutoffDate.toISOString()]
      );

      for (const record of oldRecords) {
        // Delete file if it exists
        if (fs.existsSync(record.file_path)) {
          fs.unlinkSync(record.file_path);
          console.log(`Deleted OCR file: ${record.file_path}`);
        }
      }

      // Delete old records
      const result = await db.run(
        'DELETE FROM ocr_results WHERE created_at < ?',
        [cutoffDate.toISOString()]
      );

      console.log(`Cleaned up ${result.changes} old OCR records`);

    } catch (error) {
      console.error('OCR cleanup error:', error);
    }
  }
}

module.exports = new OCRService();