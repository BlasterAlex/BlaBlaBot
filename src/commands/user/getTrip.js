const fs = require('fs');
const UserRepository = require('../../repositories/UserRepository');
const Emitter = require('pattern-emitter');
const enterTrip = require('../user/enterTrip');

// Получение необходимой поездки из бд или запрос ввода пользователем
module.exports = function (bot, chatId, callback) {
  UserRepository.find(chatId, function (user) {

    // Пользователь на найден
    if (!user.length) {
      return enterTrip(bot, chatId, 'all', callback);
    }

    // Вывод сохраненного запроса и клавиатуры для ответа пользователя
    let messageId;
    const search = 'search';
    const change = 'change';
    const cancel = 'cancel';
    bot.sendMessage(chatId, 'У вас есть сохраненный запрос:\n\n' +
      `Дата: *${user[0].date}*\n` +
      `Время: *${user[0].time}*\n` +
      `Откуда: *${user[0].from[0]}*\n` +
      `Куда: *${user[0].to[0]}*\n` +
      `Сортировка: *${user[0].sortBy == 'price' ? 'по цене' : 'по времени'}*`, {
      parse_mode: 'markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Поиск', callback_data: search },
            { text: 'Изменить', callback_data: change },
            { text: 'Отмена', callback_data: cancel }
          ]
        ]
      }
    })
      .then(function (sender) {
        messageId = sender.message_id;
      });

    // Подключение обработчиков событий
    const emitter = new Emitter();
    bot.on('callback_query', function (callbackQuery) {
      if (callbackQuery.from.id === chatId)
        bot.answerCallbackQuery(callbackQuery.id).then(function () {
          emitter.emit(callbackQuery.data, callbackQuery.data);
        });
    });

    // Удаление клавиатуры и обработчиков событий
    const events = [search, change, cancel];
    const dropInlineKeyboard = (callback) => {
      bot.deleteMessage(chatId, messageId);
      events.forEach(function (event) {
        emitter.removeAllListeners(event);
      });
      callback();
    };

    emitter.on(search, function () {
      dropInlineKeyboard(() => {
        callback(user[0]);
      });
    });

    emitter.on(change, function () {
      dropInlineKeyboard(() => {
        bot.sendMessage(chatId, fs.readFileSync('data/messages/editHelp.txt'), {
          parse_mode: 'markdown'
        });
      });
    });

    emitter.on(cancel, function () {
      dropInlineKeyboard(() => {
        callback(null);
      });
    });

  });
};