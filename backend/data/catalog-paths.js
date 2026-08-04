const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

module.exports = {
  HOME_RECEIPTS: path.join(DATA_DIR, 'home-receipts.json'),
  PAY_QR_MERCHANTS: path.join(DATA_DIR, 'pay-qr-merchants.json'),
};
