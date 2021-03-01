const fs = require('fs');

// Подключаемые модули
const whoami = require('./user/whoami');
const bestTrips = require('../utils/bestTrips');
const getTrip = require('./user/getTrip');
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
        bestTrips(bot, chatId, tripQuery);
      });
      break;
    case (match = lowerMsg.match(/(\/trips|поездки)\s*(.*)/) || {}).input: {
      getTrip(bot, chatId, (tripQuery) => {
        if (!tripQuery)
          return bot.sendMessage(chatId, 'Вы отменили запрос', {
            parse_mode: 'markdown'
          });
        bestTrips(bot, chatId, tripQuery, match[2] ? parseInt(match[2]) : 3);
      });
      break;
    }
    case '/edit':
    case 'ред':
      enterTrip(bot, chatId, () => {
        bot.sendMessage(chatId, 'Запрос успешно изменен!\n/trip для поиска поездок по запросу', {
          parse_mode: 'markdown'
        });
      });
      break;
    case '/help':
    case '/start':
    case 'помощь':
      bot.sendMessage(chatId, fs.readFileSync('data/messages/help.txt'), {
        parse_mode: 'markdown'
      });
      break;
  }

};