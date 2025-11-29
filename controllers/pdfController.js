import pdfService from '../services/pdfService.js';

// Extract text from uploaded PDF
export const extractContent = async (req, res) => {
    try {
        console.log('📥 Extract content request received');
        console.log('   - Headers:', JSON.stringify(req.headers['content-type']));
        console.log('   - Body keys:', Object.keys(req.body));
        console.log('   - File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'MISSING');

        if (!req.file) {
            console.error('❌ No file found in request. Check "pdf" field name.');
            return res.status(400).json({
                error: 'No PDF file uploaded',
                hint: 'Ensure you are using form-data with key "pdf"'
            });
        }

        console.log(`📥 Processing PDF: ${req.file.originalname} `);

        // Extract text
        const text = await pdfService.extractTextFromBuffer(req.file.buffer);

        // Check for insufficient text (e.g. scanned images)
        if (!text || text.trim().length < 100) {
            return res.status(400).json({
                error: 'Insufficient text content',
                message: 'The PDF appears to be a scanned image or has very little text. Please use a text-based PDF or a document with more content.'
            });
        }

        res.json({
            success: true,
            text: text,
            metadata: {
                filename: req.file.originalname,
                size: req.file.size,
                pageCount: 0 // pdf-parse might provide this, but keeping it simple for now
            }
        });

    } catch (error) {
        console.error('❌ PDF extract controller error:', error);
        res.status(500).json({ error: error.message });
    }
};
