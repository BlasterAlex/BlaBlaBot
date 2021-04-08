const fs = require('fs');
const axios = require('axios');
const geodist = require('geodist');
const cronJobs = require('./cronJobs');
const isEqual = require('lodash.isequal');
const pingHeroku = require('../web').pingHeroku;
const messageKeyboard = require('./UI/messageKeyboard');
const UserRepository = require('../repositories/UserRepository');

// Ключ от blablacar-api
const apiKey = process.env.BLABLACAR_TOKEN || require('../../config/private.json').BLABLACAR_TOKEN;

// Скачивание списка поездок с BlaBlaCar
const loadTrips = (link, trips = [], fromCursor = null) => {
  return axios.get(link + (fromCursor ? `&from_cursor=${fromCursor}` : ''))
    .then(response => {
      trips = trips.concat(response.data.trips);
      nextCursor = response.data.next_cursor;
      if (nextCursor === undefined)
        return trips;
      return loadTrips(link, trips, nextCursor);
    })
    .catch(error => {
      console.error(error);
    });
};

// Изменение формата возвращаемых результатов
const reformatTrips = (trips) => {
  return trips.map(trip => {
    const waypoints = trip.waypoints;
    const trip_date = waypoints[0]
      .date_time.match(/(\d{4}-\d{2}-\d{2})T/)[1];
    const trip_duration = waypoints
      .map(wp => wp.date_time.match(/T(\d{2}:\d{2})/)[1])
      .join('-');

    new_trip = {
      'link': trip.link,
      'trip_date': trip_date,
      'trip_duration': trip_duration,
      'waypoints': [waypoints[0].place.address, waypoints[1].place.address],
      'price': trip.price.amount + ' ' + trip.price.currency,
      'walking': trip.walking
    };
    if (trip.vehicle !== undefined)
      new_trip.car = trip.vehicle.make + ' ' + trip.vehicle.model;
    return new_trip;
  });
};

// Получение форматированного списка поездок
const getTrips = (query, callback) => {

  // Для измерения расстояния пешком
  const distUnit = 'meters';

  // Максимальное расстояние пешком для фильтрации поезок
  const maxWalkingDist = 10000;

  // Запрос к blablacar-api
  const url = `https://public-api.blablacar.com/api/v3/trips?key=${apiKey}&` +
    `from_coordinate=${query.from[1].join(',')}&from_country=RU&to_coordinate=${query.to[1].join(',')}&` +
    `to_country=RU&locale=ru-RU&currency=RUB&start_date_local=${query.date}T${query.time}&` +
    `count=25&sort=${query.sortBy}:asc`;

  // Выполнение поиска
  loadTrips(url).then(trips => {

    // Добавление информации о расстоянии пешком до начальной точки и после конечной
    trips.forEach(function (trip, index) {
      const waypoints = trip.waypoints;
      const walking_before = Math.round(geodist(query.from[1], [waypoints[0].place.latitude, waypoints[0].place.longitude], { exact: true, unit: distUnit }));
      const walking_after = Math.round(geodist(query.to[1], [waypoints[1].place.latitude, waypoints[1].place.longitude], { exact: true, unit: distUnit }));
      this[index].walking = {
        'before': walking_before,
        'after': walking_after
      };
      this[index].walking_distance = walking_before + walking_after;
    }, trips);

    // Отбор подходящих поездок по длине пешего расстояния
    trips = trips.filter(trip => trip.walking_distance < maxWalkingDist);

    // Изменение формата возвращаемых результатов
    trips = reformatTrips(trips);

    callback(trips);
  });

};

// Формирование строки для вывода
const tripsToString = (trips, tripsQty) => {
  let tripStrs = [];
  if (tripsQty === undefined)
    tripsQty = trips.length;

  trips.slice(0, tripsQty).forEach(trip => {
    tripStrs.push(
      `Время: *${trip.trip_duration}*\n` +
      `Цена: _${trip.price}_\n` +
      `Откуда: ${trip.waypoints[0]} (${trip.walking.before} m)\n` +
      `Куда: ${trip.waypoints[1]} (${trip.walking.after} m)\n` +
      (trip.car !== undefined ? `Машина: ${trip.car}\n` : '') +
      trip.link
    );
  });

  return tripStrs.length ? tripStrs.join('\n\n') : '';
};

// Поиск наулучших поездок
module.exports.search = function (bot, chatId, query, tripsQty = 1) {

  bot.sendMessage(chatId, 'Ищу поездки для вас :)', {
    parse_mode: 'markdown'
  }).then(function (sender) {

    // Сохранение id сообщения
    const messageId = sender.message_id;

    // Получение списка поездок
    getTrips(query, trips => {

      // Выборка заданного количества лучших поездок
      const tripStr = tripsToString(trips, tripsQty);

      // Вывод результата поиска
      bot.deleteMessage(chatId, messageId).then(() => {

        // Текст сообщения
        const message = tripStr.length ?
          'Вот, что я нашёл:\n\n' + tripStr :
          fs.readFileSync('data/messages/tripsNotFound.txt');

        messageKeyboard(bot, chatId, message,
          new Map([
            ['removeCron', {
              text: 'Поездка найдена',
              callback: () => {
                cronJobs.remove(bot, chatId);
              }
            }],
            ['createCron', {
              text: 'Уведомить о новых поездках',
              callback: () => {
                cronJobs.create(bot, chatId, trips);
              }
            }]
          ]));

      });
    });
  });

};

// Фоновая проверка на появление новых поездок
module.exports.research = function (bot, chatId) {

  if (process.env.HEROKU_URL)
    pingHeroku(process.env.HEROKU_URL);

  UserRepository.find(chatId, function (users) {
    let user = users[0];

    // Если это неактивная задача
    if (!user.searchTrips) {
      return cronJobs.remove(bot, chatId);
    }

    // Получение нового списка поездок
    getTrips(user, trips => {

      const difference = trips.filter(trip => user.savedResult.every(x => !isEqual(x, trip)));
      if (!difference.length) return;

      // Сохранения текущего результата поиска
      user['savedResult'] = trips;
      UserRepository.save(chatId, user);

      // Текст сообщения
      const message = 'Новые поездочки:\n\n' + tripsToString(difference) +
        '\n\n' + fs.readFileSync('data/messages/cronFound.txt');

      messageKeyboard(bot, chatId, message,
        new Map([
          ['removeCron', {
            text: 'Поездка найдена',
            callback: () => {
              cronJobs.remove(bot, chatId);
            }
          }]
        ]));

    });
  });
};