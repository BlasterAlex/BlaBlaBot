const Emitter = require('pattern-emitter');

module.exports = (bot, chatId, message, buttons, thenAction, message_id) => {

  // Действие по умолчанию
  if (thenAction === undefined)
    thenAction = 'edit';

  // Отправить новое сообщение или отредактировать старое
  if (message_id === undefined)
    bot.sendMessage(chatId, message, {
      parse_mode: 'markdown',
      reply_markup: {
        inline_keyboard: [
          new Array(...buttons)
            .map(pair => { return { text: pair[1].text, callback_data: pair[0] }; })
        ]
      }
    }).then(function (sender) {
      message_id = sender.message_id;
    });
  else
    bot.editMessageText(message, {
      chat_id: chatId,
      message_id: message_id,
      parse_mode: 'markdown',
      reply_markup: {
        inline_keyboard: [
          new Array(...buttons)
            .map(pair => { return { text: pair[1].text, callback_data: pair[0] }; })
        ]
      }
    });

  // Подключение обработчиков событий
  const emitter = new Emitter();
  bot.on('callback_query', function (callbackQuery) {
    if (callbackQuery.from.id === chatId)
      bot.answerCallbackQuery(callbackQuery.id).then(function () {
        emitter.emit(callbackQuery.data, callbackQuery.data);
      });
  });

  // Выполнение функции после нажатия кнопки
  const events = new Array(...buttons.keys());
  const afterAction = (callback) => {

    // Действие с текущим сообщением
    if (thenAction === 'edit')
      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: message_id,
        parse_mode: 'markdown'
      });
    else
      bot.deleteMessage(chatId, message_id);

    // Удаление всех обработчиков событий
    events.forEach(function (event) {
      emitter.removeAllListeners(event);
    });

    // Выполнение действий после
    callback();
  };

  // Обработка нажатия кнопки
  events.forEach(function (event) {
    emitter.on(event, () => {
      afterAction(buttons.get(event).callback);
    });
  });

};