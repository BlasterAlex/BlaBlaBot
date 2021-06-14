const fs = require('fs');
const UserRepository = require('../../repositories/UserRepository');
const enterTrip = require('../user/enterTrip');
const MessageKeyboard = require('../../utils/UI/messageKeyboard');

// Получение необходимой поездки из бд или запрос ввода пользователем
module.exports = function (bot, chatId, callback) {
  UserRepository.find(chatId, function (user) {

    // Пользователь на найден
    if (!user.length) {
      return enterTrip(bot, chatId, 'all', callback);
    }

    const message = 'У вас есть сохраненный запрос:\n\n' +
      `Дата: *${user[0].date}*\n` +
      `Время: *${user[0].time}*\n` +
      (user[0].maximumTime ? `Ограничение: *${user[0].maximumTime}*\n` : '') +
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