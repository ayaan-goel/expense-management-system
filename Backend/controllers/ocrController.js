const ocrService = require('../models/ocrService');
const { saveOCRFile } = require('../middleware/fileUpload');

class OCRController {
  /**
   * Parse receipt using OCR
   */
  async processReceipt(req, res) {
    try {
      // Check if file was uploaded
      if (!req.files || !req.files.receipt) {
        return res.status(400).json({ error: 'Receipt file is required' });
      }

      const receiptFile = req.files.receipt;
      
      // Save file temporarily for OCR processing
      const filePath = saveOCRFile(receiptFile, req.user.id);

      console.log(`Starting OCR processing for file: ${filePath}`);

      // Process the file with OCR
      const ocrResult = await ocrService.parseReceipt(filePath);

      if (!ocrResult.success) {
        return res.status(500).json({ 
          error: 'OCR processing failed',
          details: 'Unable to extract text from the uploaded receipt'
        });
      }

      const { parsedData, confidence, ocrId } = ocrResult;

      // Prepare response with extracted data
      const response = {
        message: 'Receipt parsed successfully',
        ocr_id: ocrId,
        overall_confidence: confidence,
        extracted_data: {
          vendor: parsedData.vendor,
          amount: parsedData.amount,
          currency: parsedData.currency,
          date: parsedData.date,
          category: parsedData.category,
          line_items: parsedData.lineItems,
          confidence_scores: parsedData.confidence_details
        },
        suggested_expense: {
          description: parsedData.vendor ? 
            `Expense at ${parsedData.vendor}` : 
            'Expense from receipt',
          amount: parsedData.amount || 0,
          currency: parsedData.currency || 'USD',
          category: parsedData.category || 'Other',
          expense_date: parsedData.date || new Date().toISOString().split('T')[0],
          remarks: parsedData.lineItems && parsedData.lineItems.length > 0 ? 
            `Items: ${parsedData.lineItems.map(item => item.description).join(', ')}` : null
        }
      };

      // Add warnings for low confidence
      if (confidence < 70) {
        response.warnings = [
          'Low OCR confidence detected. Please verify the extracted information carefully.'
        ];
      }

      if (parsedData.confidence_details.amount < 80 && parsedData.amount) {
        response.warnings = response.warnings || [];
        response.warnings.push('Amount detection confidence is low. Please verify the amount.');
      }

      if (parsedData.confidence_details.date < 80 && parsedData.date) {
        response.warnings = response.warnings || [];
        response.warnings.push('Date detection confidence is low. Please verify the date.');
      }

      console.log(`OCR processing completed for user ${req.user.email}, confidence: ${confidence}%`);

      res.json(response);

    } catch (error) {
      console.error('OCR parse receipt error:', error);
      
      // Provide more specific error messages
      if (error.message && error.message.includes('Tesseract')) {
        res.status(500).json({ 
          error: 'OCR engine error',
          details: 'The optical character recognition service encountered an error processing your receipt.'
        });
      } else if (error.message && error.message.includes('file')) {
        res.status(400).json({ 
          error: 'File processing error',
          details: 'There was an issue processing the uploaded file. Please ensure it is a valid image or PDF.'
        });
      } else {
        res.status(500).json({ 
          error: 'OCR processing failed',
          details: 'An unexpected error occurred while processing your receipt.'
        });
      }
    }
  }

  /**
   * Get OCR processing result by ID
   */
  async getOcrResult(req, res) {
    try {
      const { ocrId } = req.params;

      const ocrResult = await ocrService.getOCRResult(ocrId);

      if (!ocrResult) {
        return res.status(404).json({ error: 'OCR result not found' });
      }

      // Check if user owns this OCR result (through expense ownership)
      if (ocrResult.expense_id) {
        const expense = await require('../models/database').get(
          'SELECT employee_id FROM expenses WHERE id = ?',
          [ocrResult.expense_id]
        );

        if (expense && expense.employee_id !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      res.json({
        ocr_result: {
          id: ocrResult.id,
          expense_id: ocrResult.expense_id,
          processing_status: ocrResult.processing_status,
          confidence_score: ocrResult.confidence_score,
          parsed_fields: ocrResult.parsed_fields,
          created_at: ocrResult.created_at
        }
      });

    } catch (error) {
      console.error('Get OCR result error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create expense from OCR data
   */
  async createExpenseFromOcr(req, res) {
    try {
      const { ocrId } = req.params;
      const { 
        amount, 
        currency, 
        category, 
        description, 
        expense_date, 
        remarks 
      } = req.body;

      // Get OCR result
      const ocrResult = await ocrService.getOCRResult(ocrId);

      if (!ocrResult) {
        return res.status(404).json({ error: 'OCR result not found' });
      }

      if (ocrResult.processing_status !== 'completed') {
        return res.status(400).json({ error: 'OCR processing is not completed yet' });
      }

      // Use provided data or fall back to OCR extracted data
      const expenseData = {
        amount: amount || ocrResult.parsed_fields.amount || 0,
        currency: currency || ocrResult.parsed_fields.currency || 'USD',
        category: category || ocrResult.parsed_fields.category || 'Other',
        description: description || 
          (ocrResult.parsed_fields.vendor ? 
            `Expense at ${ocrResult.parsed_fields.vendor}` : 
            'Expense from receipt'),
        expense_date: expense_date || 
          ocrResult.parsed_fields.date || 
          new Date().toISOString().split('T')[0],
        remarks: remarks || 
          (ocrResult.parsed_fields.lineItems && ocrResult.parsed_fields.lineItems.length > 0 ? 
            `Items: ${ocrResult.parsed_fields.lineItems.map(item => item.description).join(', ')}` : 
            null)
      };

      // Create the expense (reuse logic from expense controller)
      const expenseController = require('./expenseController');
      
      // Temporarily modify the request to include OCR data
      req.body = expenseData;
      
      // Call the create expense method
      await expenseController.createExpense(req, res);

      // If expense was created successfully, link it to the OCR result
      if (res.statusCode === 201) {
        // The expense ID should be available in the response
        // We'll update the OCR result to link it to the created expense
        // This is a bit of a hack, but it works within the current structure
        
        console.log(`Expense created from OCR result ${ocrId} by ${req.user.email}`);
      }

    } catch (error) {
      console.error('Create expense from OCR error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get OCR processing statistics (admin only)
   */
  async getOcrStats(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const db = require('../models/database');

      // Get OCR processing statistics
      const stats = await db.get(`
        SELECT 
          COUNT(*) as total_processed,
          SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN processing_status = 'pending' THEN 1 ELSE 0 END) as pending,
          AVG(CASE WHEN processing_status = 'completed' THEN confidence_score ELSE NULL END) as avg_confidence,
          SUM(CASE WHEN expense_id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_expenses
        FROM ocr_results
      `);

      // Get confidence distribution
      const confidenceDistribution = await db.all(`
        SELECT 
          CASE 
            WHEN confidence_score >= 90 THEN '90-100%'
            WHEN confidence_score >= 80 THEN '80-89%'
            WHEN confidence_score >= 70 THEN '70-79%'
            WHEN confidence_score >= 60 THEN '60-69%'
            ELSE 'Below 60%'
          END as confidence_range,
          COUNT(*) as count
        FROM ocr_results 
        WHERE processing_status = 'completed'
        GROUP BY confidence_range
        ORDER BY confidence_score DESC
      `);

      res.json({
        processing_statistics: {
          ...stats,
          avg_confidence: stats.avg_confidence ? Math.round(stats.avg_confidence * 10) / 10 : 0,
          success_rate: stats.total_processed > 0 ? 
            Math.round((stats.successful / stats.total_processed) * 100 * 10) / 10 : 0
        },
        confidence_distribution: confidenceDistribution
      });

    } catch (error) {
      console.error('Get OCR stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Reprocess failed OCR result (admin only)
   */
  async reprocessOcr(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { ocrId } = req.params;

      // Get OCR result
      const ocrResult = await ocrService.getOCRResult(ocrId);

      if (!ocrResult) {
        return res.status(404).json({ error: 'OCR result not found' });
      }

      if (ocrResult.processing_status === 'completed') {
        return res.status(400).json({ error: 'OCR result is already completed' });
      }

      // Check if file still exists
      const fs = require('fs');
      if (!fs.existsSync(ocrResult.file_path)) {
        return res.status(400).json({ error: 'Original file no longer exists' });
      }

      // Reprocess the file
      const reprocessResult = await ocrService.parseReceipt(ocrResult.file_path, ocrResult.expense_id);

      console.log(`OCR reprocessed: ID ${ocrId} by ${req.user.email}`);

      res.json({
        message: 'OCR reprocessing completed',
        result: {
          success: reprocessResult.success,
          confidence: reprocessResult.confidence,
          extracted_data: reprocessResult.parsedData
        }
      });

    } catch (error) {
      console.error('Reprocess OCR error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get all OCR results (admin only)
   */
  async getAllOcrResults(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const db = require('../models/database');
      const { page, limit, offset } = req.pagination;

      const results = await db.all(
        `SELECT o.id, o.expense_id, o.file_path, o.parsed_fields, o.confidence_score, 
                o.processing_status, o.created_at, e.employee_id, u.name as employee_name
         FROM ocr_results o
         LEFT JOIN expenses e ON o.expense_id = e.id
         LEFT JOIN users u ON e.employee_id = u.id
         ORDER BY o.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      const totalCount = await db.get('SELECT COUNT(*) as count FROM ocr_results');

      res.json({
        ocr_results: results,
        pagination: {
          page,
          limit,
          total: totalCount.count,
          totalPages: Math.ceil(totalCount.count / limit)
        }
      });

    } catch (error) {
      console.error('Get all OCR results error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

const ocrController = new OCRController();

module.exports = {
  processReceipt: ocrController.processReceipt.bind(ocrController),
  getOcrResult: ocrController.getOcrResult.bind(ocrController),
  createExpenseFromOcr: ocrController.createExpenseFromOcr.bind(ocrController),
  getOcrStats: ocrController.getOcrStats.bind(ocrController),
  reprocessOcr: ocrController.reprocessOcr.bind(ocrController),
  getAllOcrResults: ocrController.getAllOcrResults.bind(ocrController)
};
