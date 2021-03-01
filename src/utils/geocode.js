const config = require('../../config/config.json');

// Настройки api
const geocoder = require('node-geocoder')({
  provider: 'opencage',
  apiKey: process.env.GEOCODER_TOKEN || require('../../config/private.json').GEOCODER_TOKEN
});

// Получение координат по адресу
module.exports = function (address, callback) {
  geocoder.geocode({
    address: address,
    countryCode: config.countryCode
  }).then(callback);
};