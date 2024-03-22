module.exports = {
  apps : [{
    name: 'OCR',
    script: './bin/www',
    watch: true,
    ignore_watch: ["captcha.png","page_screenshot.png","eng.traineddata", "node_modules"],
  }]
};