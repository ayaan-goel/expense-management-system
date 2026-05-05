const Tesseract = require('tesseract.js');
const Database = require('sqlite3').Database;
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../database.sqlite');

class OCRService {
  constructor() {
    this.confidenceThreshold = process.env.OCR_CONFIDENCE_THRESHOLD || 60;
  }

  /**
   * Process receipt image and extract text
   */
  async processReceipt(filePath, originalFilename, userId, companyId) {
    const ocrId = await this.createOCRRecord(originalFilename, filePath, userId, companyId);
    
    try {
      await this.updateOCRStatus(ocrId, 'processing');
      
      // Perform OCR
      const ocrResult = await Tesseract.recognize(filePath, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const rawText = ocrResult.data.text;
      const confidence = ocrResult.data.confidence;

      // Parse the extracted text
      const parsedData = this.parseReceiptText(rawText);

      // Update OCR record with results
      await this.updateOCRResults(ocrId, rawText, parsedData, confidence, 'completed');

      return {
        id: ocrId,
        rawText,
        parsedData,
        confidence,
        status: 'completed'
      };

    } catch (error) {
      console.error('OCR processing error:', error);
      await this.updateOCRResults(ocrId, null, null, 0, 'failed', error.message);
      
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Parse receipt text to extract structured data
   */
  parseReceiptText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    const parsed = {
      vendor: null,
      amount: null,
      date: null,
      line_items: [],
      category: null
    };

    // Extract vendor (usually first meaningful line)
    const vendorLine = lines.find(line => 
      line.length > 3 && 
      !line.match(/^\d/) && 
      !line.toLowerCase().includes('receipt') &&
      !line.toLowerCase().includes('invoice')
    );
    if (vendorLine) {
      parsed.vendor = vendorLine.substring(0, 50); // Limit length
    }

    // Extract amounts (look for currency symbols and decimal patterns)
    const amountPatterns = [
      /\$(\d{1,6}\.?\d{0,2})/g,
      /(\d{1,6}\.\d{2})/g,
      /total[:\s]*\$?(\d{1,6}\.?\d{0,2})/gi,
      /amount[:\s]*\$?(\d{1,6}\.?\d{0,2})/gi
    ];

    const amounts = [];
    amountPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const amount = parseFloat(match[1]);
        if (amount > 0 && amount < 10000) { // Reasonable range
          amounts.push(amount);
        }
      }
    });

    if (amounts.length > 0) {
      parsed.amount = Math.max(...amounts); // Assume largest amount is total
    }

    // Extract date patterns
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/g,
      /(\d{1,2}-\d{1,2}-\d{4})/g,
      /(\d{4}-\d{1,2}-\d{1,2})/g
    ];

    datePatterns.forEach(pattern => {
      const match = pattern.exec(text);
      if (match && !parsed.date) {
        parsed.date = this.normalizeDate(match[1]);
      }
    });

    // Extract line items (simple heuristic)
    const itemPatterns = /^(.+?)\s+\$?(\d{1,4}\.?\d{0,2})$/gm;
    let itemMatch;
    while ((itemMatch = itemPatterns.exec(text)) !== null) {
      const item = itemMatch[1].trim();
      const amount = parseFloat(itemMatch[2]);
      
      if (item.length > 2 && item.length < 50 && amount > 0 && amount < 1000) {
        parsed.line_items.push({
          item: item,
          amount: amount
        });
      }
    }

    // Categorize based on vendor or keywords
    parsed.category = this.categorizeExpense(parsed.vendor || '', text);

    return parsed;
  }

  /**
   * Normalize date to YYYY-MM-DD format
   */
  normalizeDate(dateString) {
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn('Could not parse date:', dateString);
    }
    return null;
  }

  /**
   * Categorize expense based on vendor and content
   */
  categorizeExpense(vendor, text) {
    const lowerVendor = vendor.toLowerCase();
    const lowerText = text.toLowerCase();

    const categories = {
      'meals': ['restaurant', 'cafe', 'food', 'lunch', 'dinner', 'starbucks', 'mcdonalds'],
      'travel': ['uber', 'lyft', 'taxi', 'hotel', 'airline', 'flight', 'gas', 'parking'],
      'office_supplies': ['staples', 'office', 'depot', 'supplies', 'pen', 'paper', 'notebook'],
      'software': ['software', 'subscription', 'saas', 'license', 'app', 'microsoft', 'adobe'],
      'equipment': ['equipment', 'computer', 'laptop', 'monitor', 'keyboard', 'mouse'],
      'utilities': ['utility', 'electric', 'internet', 'phone', 'mobile']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      for (const keyword of keywords) {
        if (lowerVendor.includes(keyword) || lowerText.includes(keyword)) {
          return category;
        }
      }
    }

    return 'other';
  }

  /**
   * Create OCR record in database
   */
  createOCRRecord(originalFilename, filePath, userId, companyId) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = `
        INSERT INTO ocr_results (company_id, user_id, original_filename, file_path, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `;
      
      db.run(sql, [companyId, userId, originalFilename, filePath], function(err) {
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
   * Update OCR processing status
   */
  updateOCRStatus(ocrId, status) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = 'UPDATE ocr_results SET status = ? WHERE id = ?';
      
      db.run(sql, [status, ocrId], function(err) {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Update OCR results in database
   */
  updateOCRResults(ocrId, rawText, parsedData, confidence, status, errorMessage = null) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = `
        UPDATE ocr_results 
        SET raw_text = ?, parsed_data = ?, confidence_score = ?, status = ?, 
            error_message = ?, processed_at = datetime('now')
        WHERE id = ?
      `;
      
      const parsedDataJson = parsedData ? JSON.stringify(parsedData) : null;
      
      db.run(sql, [rawText, parsedDataJson, confidence, status, errorMessage, ocrId], function(err) {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get OCR result by ID
   */
  getOCRResult(ocrId, userId, companyId) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = `
        SELECT * FROM ocr_results 
        WHERE id = ? AND user_id = ? AND company_id = ?
      `;
      
      db.get(sql, [ocrId, userId, companyId], (err, row) => {
        db.close();
        
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          // Parse JSON data
          if (row.parsed_data) {
            try {
              row.parsed_data = JSON.parse(row.parsed_data);
            } catch (e) {
              console.warn('Failed to parse OCR data:', e);
              row.parsed_data = null;
            }
          }
          resolve(row);
        }
      });
    });
  }

  /**
   * Get OCR results for a user/company with pagination
   */
  getOCRResults(userId, companyId, limit = 20, offset = 0) {
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH);
      
      const sql = `
        SELECT * FROM ocr_results 
        WHERE user_id = ? AND company_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      db.all(sql, [userId, companyId, limit, offset], (err, rows) => {
        db.close();
        
        if (err) {
          reject(err);
        } else {
          // Parse JSON data for each row
          const results = rows.map(row => {
            if (row.parsed_data) {
              try {
                row.parsed_data = JSON.parse(row.parsed_data);
              } catch (e) {
                row.parsed_data = null;
              }
            }
            return row;
          });
          resolve(results);
        }
      });
    });
  }
}

module.exports = new OCRService();