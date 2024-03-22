const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const path = require('path');

var OEM = Tesseract.OEM;

// 對圖片進行預處理以提高 Tesseract 的辨識準確度
async function preprocessImage(imagePath) {
    console.log(`開始預處理圖像${imagePath}`);
    try {
        const image = await Jimp.read(imagePath);
        await image
        .resize(128, 50) // resize
        .gaussian(1) // 高斯
        .contrast(0.8) // 對比
        .writeAsync(imagePath); // 將處理後的圖像保存回原路徑
        console.log(`圖像處理完成${imagePath}`);
    } catch (error) {
        console.error(`圖像處理失敗${error}`);
    }
}

// 解析驗證碼，並進行計算
function parseAndCalculateCaptcha(text) {
    // 移除所有非數字
    let cleanedText = text.replace(/[^0-9]/g, '');
    // 匹配兩位數加一位數的模式
    let regex = /(\d{2})(\d{1})/;
    let matches = cleanedText.match(regex);

    if (matches && matches.length === 3) {
      // 解析數字並計算
      const num1 = parseInt(matches[1], 10);
      const num2 = parseInt(matches[2], 10);
      const sum = num1 + num2;
      console.log(`${num1} + ${num2} = ${sum}`);
      return sum.toString();
    } else {
      console.log('驗證碼格式不符:', cleanedText);
      return {
        success: false,
        message: "驗證碼格式不符" // 返回失败的原因
    };
    }
}

// 假設的正則表達式檢查函數
function validateInputData(idno, approveDate, endStayPeriod, barcodeNo) {
    // 正則表達式範例，根據實際需求調整
    const idnoRegex = /^[A-Z]\d{9}$/; // 統一證號格式: A800348135
    const dateRegex = /^\d{8}$/; // 日期格式: 20230809
    const barcodeNoRegex = /^[A-Z]\d{9}$/; // 台灣身份證號格式: F230001240 

    return idnoRegex.test(idno) &&
           dateRegex.test(approveDate) &&
           dateRegex.test(endStayPeriod) &&
           barcodeNoRegex.test(barcodeNo);
}

// 自動填寫表單並處理驗證碼
async function automateFormFilling(idno, approveDate, endStayPeriod, barcodeNo) {

  // 驗證輸入的資料格式
  if (!validateInputData(idno, approveDate, endStayPeriod, barcodeNo)) {
   console.log('輸入資料格式不符');
   return { success: false, message: '輸入資料格式不符' };
  };

  const browser = await puppeteer.launch({
      headless: true, //false: 打開瀏覽器
      args: ['--start-maximized'] // 啟動時最大化視窗
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 }); // 網頁大小
  await page.goto('https://icinfo.immigration.gov.tw/NIL_WEB/NFCData.aspx');

  // 表單資料
  await page.type('#IDNO', idno || ''); // 統一證號
  await page.type('#APPROVE_DATE', approveDate || ''); // 核發日期
  await page.type('#END_STAY_PERIOD', endStayPeriod || ''); // 居留期限
  await page.type('#BARCODE_NO', barcodeNo || ''); // 台灣身份證 ?
  
  
      // 重新定位驗證碼圖片並截圖
      const captchaSelector = '#Image2';
      await page.waitForSelector(captchaSelector);
      const captchaElement = await page.$(captchaSelector);
      const captchaPath = path.resolve('captcha.png');
      await captchaElement.screenshot({ path: captchaPath });
  
      // 預處理圖像和OCR辨識
      console.log("開始預處理圖像...");
      await preprocessImage(captchaPath);
  
      console.log("開始辨識驗證碼...");
      const tesseractResult = await Tesseract.recognize(captchaPath, 'eng', {
          init_oem: OEM.TESSERACT_ONLY,
          tessedit_char_whitelist: '0123456789',
          logger: m => console.log(m)
      });
      console.log("驗證碼辨識完成:", tesseractResult.data.text);
  
      const captchaCalculation = parseAndCalculateCaptcha(tesseractResult.data.text);
      if (captchaCalculation) {
        await page.type('#TextBox1', captchaCalculation);
        await page.click('#ReNext');
        try {
            await page.waitForFunction(() => document.getElementById('lblResult'));

            const resultText = await page.evaluate(() => document.getElementById('lblResult')?.innerText || '');
            console.log('resultText:', resultText);

            let result;
            if (resultText.includes('資料相符')) {
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 });
                const screenshotPath = path.resolve('page_screenshot.png');
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log('截圖已保存至:', screenshotPath);


                return {
                    success: true,
                    message: resultText,
                    screenshotPath: screenshotPath
                };
            } else if(resultText.includes('驗證碼錯誤')) {
                return {
                    success: false,
                    message: resultText // 返回失败的原因
                };
            } else {
                return { success: false, message: resultText };
            }

        } catch (error) {
            console.error('導航超時或其他錯誤:', error);
            return { success: false, message: "導航超時或其他錯誤" };
        }
    }
}
// 輸出來獲取API資料
module.exports = { automateFormFilling };