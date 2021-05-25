const fs = require('fs');

// Подключаемые модули
const whoami = require('./user/whoami');
const getTrip = require('./user/getTrip');
const bestTrips = require('../utils/bestTrips');
const enterTrip = require('../commands/user/enterTrip');

// Разбор команд пользователя
module.exports = (bot, msg) => {
  const chatId = msg.chat.id;
  const message = msg.text;
  const lowerMsg = message.toLowerCase();

  let match;
  switch (lowerMsg) {
    case '/whoami':
    case 'кто я':
      whoami(bot, chatId);
      break;
    case '/trip':
    case 'поездка':
      getTrip(bot, chatId, (tripQuery) => {
        if (!tripQuery)
          return bot.sendMessage(chatId, 'Вы отменили запрос', {
            parse_mode: 'markdown'
          });
        bestTrips.search(bot, chatId, tripQuery);
      });
      break;
    // Поездки
    case (match = lowerMsg.match(/(\/trips|поездки)\s*(.*)/) || {}).input: {
      getTrip(bot, chatId, (tripQuery) => {
        if (!tripQuery)
          return bot.sendMessage(chatId, 'Вы отменили запрос', {
            parse_mode: 'markdown'
          });
        bestTrips.search(bot, chatId, tripQuery, match[2] ? parseInt(match[2]) : 10);
      });
      break;
    }
    // Изменение запроса
    case (match = lowerMsg.match(/(\/edit|ред)\s*(.*)/) || {}).input: {
      enterTrip(bot, chatId, (match[2] ? match[2] : 'all'), (res, status = 200) => {
        if (!res)
          return bot.sendMessage(chatId, 'Вы отменили запрос', {
            parse_mode: 'markdown'
          });

        if (status === 400 || status === 404)
          return bot.sendMessage(chatId, res, {
            parse_mode: 'markdown'
          });

        bot.sendMessage(chatId, fs.readFileSync('data/messages/editSuccess.txt'), {
          parse_mode: 'markdown'
        });
      });
      break;
    }
    case '/help':
    case '/start':
    case 'помощь':
      bot.sendMessage(chatId, fs.readFileSync('data/messages/help.txt'), {
        parse_mode: 'markdown'
      });
      break;
  }

};