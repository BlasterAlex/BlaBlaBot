const Emitter = require('pattern-emitter');

// Генерирует случайный идентификатор
var ID = function () { return Math.random().toString(36).substr(2, 9); };

// Класс сообщения с кнопками
class MessageKeyboard {

  constructor(bot, chatId, message, buttons, thenAction, message_id, inline) {

    this.bot = bot;
    this.chatId = chatId;
    this.removed = false;

    // Выводимое сообщение
    this.message = message;

    // Информация о кнопках на клавиатуре
    this.buttons = buttons;

    // Действие с сообщением после выполнения действия (edit || delete)
    this.thenAction = (thenAction === undefined) ? 'edit' : thenAction;

    // Расположение кнопок (в линию или в столбец)
    this.inline = (inline === undefined) ? true : inline;

    // Для редактирования сообщения
    this.message_id = message_id;

    // Создание клавиатуры
    this.createKeyboard();
  }

  // Создание виджета клавиатуры
  createKeyboard() {

    // Уникальный идентификатор текущей клавиатуры 
    const keyboardID = ID();

    // Кнопки на клавиатуре
    const inline_keyboard =
      (this.inline) ?
        [new Array(...this.buttons)
          .map(pair => { return { text: pair[1].text, callback_data: pair[0] + '_' + keyboardID }; })] :
        new Array(...this.buttons)
          .map(pair => { return [{ text: pair[1].text, callback_data: pair[0] + '_' + keyboardID }]; });

    const bot = this.bot;
    const chatId = this.chatId;
    const message = this.message;
    const buttons = this.buttons;
    const self = this;

    // Отправить новое сообщение или отредактировать старое
    if (self.message_id === undefined)
      bot.sendMessage(chatId, message, {
        parse_mode: 'markdown',
        reply_markup: { inline_keyboard: inline_keyboard }
      }).then(function (sender) {
        self.message_id = sender.message_id;
      });
    else
      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: self.message_id,
        parse_mode: 'markdown',
        reply_markup: { inline_keyboard: inline_keyboard }
      });

    // Подключение обработчиков событий
    this.emitter = new Emitter();
    bot.on('callback_query', function (callbackQuery) {

      const lastUnderscore = callbackQuery.data.lastIndexOf('_');
      const data = callbackQuery.data.slice(0, lastUnderscore);
      const id = callbackQuery.data.slice(lastUnderscore + 1);

      if (callbackQuery.from.id === chatId && keyboardID == id)
        bot.answerCallbackQuery(callbackQuery.id).then(function () {
          self.emitter.emit(data, data);
        });
    });

    // Выполнение функции после нажатия кнопки
    this.events = new Array(...buttons.keys());

    // Обработка нажатия кнопки
    this.events.forEach(function (event) {
      self.emitter.on(event, () => {
        self.remove(buttons.get(event).callback);
      });
    });

  }


  // Удаление виджета и всех обработчиков событий
  remove(callback) {

    // Ссылка на текущий объект
    const self = this;

    // Состояние клавиатуры
    if (this.removed) {
      if (callback)
        callback();
      return;
    }
    this.removed = true;

    // Действие с текущим сообщением
    if (this.thenAction === 'edit')
      this.bot.editMessageText(this.message, {
        chat_id: this.chatId,
        message_id: this.message_id,
        parse_mode: 'markdown'
      });
    else
      this.bot.deleteMessage(this.chatId, this.message_id);

    // Удаление всех обработчиков событий
    this.events.forEach(function (event) {
      self.emitter.removeAllListeners(event);
    });

    // Выполнение действий после
    if (callback) {
      callback();
    }
  }

}

module.exports = MessageKeyboard;