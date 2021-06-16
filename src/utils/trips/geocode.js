const config = require('../../../config/app.json');

// Настройки api
const geocoder = require('node-geocoder')({
  provider: 'opencage',
  apiKey: process.env.GEOCODER_TOKEN || require('../../../config/env.json').GEOCODER_TOKEN
});

// Получение координат по адресу
module.exports.getGeocode = function (address, callback) {
  geocoder.geocode({
    address: address,
    countryCode: config.countryCode
  }).then(callback);
};

// Получение адреса по координатам
module.exports.getAddress = function (location, callback) {
  geocoder.reverse({ lat: location.latitude, lon: location.longitude }).then(callback);
};