const axios = require('axios');
const geodist = require('geodist');

// Ключ от blablacar-api
const apiKey = process.env.BLABLACAR_TOKEN || require('../../config/private.json').BLABLACAR_TOKEN;

// Получение всех поездок
const getTrips = (link, trips = [], fromCursor = null) => {
  return axios.get(link + (fromCursor ? `&from_cursor=${fromCursor}` : ''))
    .then(response => {
      trips = trips.concat(response.data.trips);
      nextCursor = response.data.next_cursor;
      if (nextCursor === undefined)
        return trips;
      return getTrips(link, trips, nextCursor);
    })
    .catch(error => {
      console.error(error);
    });
};

// Изменение формата возвращаемых результатов
const reformatTrips = function (trips) {
  return trips.map(trip => {
    const waypoints = trip.waypoints;
    const trip_duration = waypoints
      .map(wp => wp.date_time.match(/T(\d{2}:\d{2})/)[1])
      .join('-');
    new_trip = {
      'link': trip.link,
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

// Поиск наулучших поездок
module.exports = function (bot, chatId, query, tripsQty = 1) {

  // Для измерения расстояния пешком
  const distUnit = 'meters';

  // Максимальное расстояние пешком для фильтрации поезок
  const maxWalkingDist = 10000;

  // Запрос к blablacar-api
  const url = `https://public-api.blablacar.com/api/v3/trips?key=${apiKey}&` +
    `from_coordinate=${query.from[1].join(',')}&from_country=RU&to_coordinate=${query.to[1].join(',')}&` +
    `to_country=RU&locale=ru-RU&currency=RUB&start_date_local=${query.date}T${query.time}&` +
    `count=25&sort=${query.sortBy}:asc`;

  bot.sendMessage(chatId, 'Ищу поездки для вас :)', {
    parse_mode: 'markdown'
  }).then(function (sender) {
    // Сохранение id сообщения
    const messageId = sender.message_id;

    // Выполнение поиска
    getTrips(url).then(trips => {

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

      // Выборка заданного количества лучших поездок
      let tripStrs = [];
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

      bot.deleteMessage(chatId, messageId).then(() => {
        bot.sendMessage(chatId, tripStrs.length ?
          'Вот, что я нашёл:\n\n' + tripStrs.join('\n\n') :
          'По данному запросу ничего не нашёл, попробуйте усточнить адрес или выбрать другое время /edit', {
          parse_mode: 'markdown'
        });
      });

    });
  });

};