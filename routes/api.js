const express = require('express');
const router = express.Router();
const fs = require('fs');

const { automateFormFilling } = require('../services/formAutomationService');

function imageToBase64(imagePath) {
    return fs.readFileSync(imagePath, { encoding: 'base64' });
}

router.post('/OCR001', async (req, res) => {
    const { idno, approveDate, endStayPeriod, barcodeNo } = req.body;

    if (!idno || !approveDate || !endStayPeriod || !barcodeNo) {
        return res.status(400).send({ message: "Missing required fields" });
    }

    try {
        const result = await automateFormFilling(idno, approveDate, endStayPeriod, barcodeNo);
        const dateTimeStr = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
        
        if (result.success) {
            const imageBase64 = imageToBase64(result.screenshotPath);
            res.json({
                ResCode: { DateTime: dateTimeStr, RtnCode: "0000", RtnDesc: `${result.message}` },
                ResBody: { image: `data:image/png;base64,${imageBase64}` }
            });
        } else {
            res.json({
                ResCode: { DateTime: dateTimeStr, RtnCode: "A101", RtnDesc: `${result.message}` },
                ResBody: { image: "" }
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal server error" });
    }
});

module.exports = router;
