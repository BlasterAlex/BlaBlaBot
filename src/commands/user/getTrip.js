const fs = require('fs');
const moment = require('moment-timezone');
const enterTrip = require('../user/enterTrip');
const MessageKeyboard = require('../../utils/UI/messageKeyboard');
const UserRepository = require('../../repositories/UserRepository');

// Конфигурационный файл
const config = require('../../../config/app.json');

// Вывод строки времени в нужном формате
moment.locale(config.locale);
const timeFormat = uTime => moment(uTime, 'HH:mm:ss', true).format('HH:mm');

// Получение необходимой поездки из бд или запрос ввода пользователем
module.exports = function (bot, chatId, callback) {
  UserRepository.find(chatId, function (user) {

    // Пользователь на найден
    if (!user.length) {
      return enterTrip(bot, chatId, 'all', callback);
    }

    const message = 'У вас есть сохраненный запрос:\n\n' +
      `Дата: *${user[0].date}*\n` +
      `Время: *${timeFormat(user[0].time)}*\n` +
      (user[0].maximumTime ? `Ограничение: *${timeFormat(user[0].maximumTime)}*\n` : '') +
      `Откуда: *${user[0].from[0]}*\n` +
      `Куда: *${user[0].to[0]}*\n` +
      `Сортировка: *${user[0].sortBy == 'price' ? 'по цене' : 'по времени'}*`;

    new MessageKeyboard(bot, chatId, message,
      new Map([
        ['search', { text: 'Поиск', callback: () => { callback(user[0]); } }],
        ['change', {
          text: 'Изменить', callback: () => {
            bot.sendMessage(chatId, fs.readFileSync('data/messages/editHelp.txt'), {
              parse_mode: 'markdown'
            });
          }
        }],
        ['cancel', { text: 'Отмена', callback: () => { callback(null); } }]
      ]), 'delete');

  });
};