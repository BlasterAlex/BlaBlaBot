const moment = require('moment-timezone');
const Emitter = require('pattern-emitter');

const config = JSON.parse(require('fs').readFileSync('config/config.json'));

// Генерирует случайный идентификатор
var ID = function () { return '_' + Math.random().toString(36).substr(2, 9); };

// Генерирует пустую строку для виджета календаря
var emptyLine = function () {
  var arr = [];
  for (var i = 0; i < 7; i++)
    arr.push({ text: ' ', callback_data: 'none' + ID() });
  return arr;
};

class Calendar {

  constructor(bot, chatId) {
    moment.locale(config.locale);

    this.bot = bot;
    this.chatId = chatId;

    this.mode = 'calendar';
    this.today = moment();
    this.emitter = new Emitter();
    this.createCallbackQueries();
  }

  // Генерирует виджет в зависимости от текущего режима
  options() {
    switch (this.mode) {
      case 'calendar':
        return { reply_markup: JSON.stringify({ inline_keyboard: this.getCalendar() }) };
      case 'month selection':
        return { reply_markup: JSON.stringify({ inline_keyboard: this.getSelection() }) };
    }
  }

  // Генерирует таблицу календаря на текущий месяц
  getCalendar() {

    // Текущий месяц
    var monthIndex = this.today.format('M') - 1;

    // Установка дня на первый день месяца
    var date = moment(1 + this.today.format('/MM/YYYY'), 'DD/MM/YYYY');

    // Добавление заголовка
    var result = [
      [
        { text: '<', callback_data: 'prev' },
        { text: date.format('MM, YYYY'), callback_data: 'month' },
        { text: '>', callback_data: 'next' }
      ]
    ];

    // Добавление названий дней недели
    var weekdays = [];
    moment.weekdaysMin(true).forEach(function (el) {
      weekdays.push({ text: el, callback_data: 'none' + ID() });
    });
    result.push(weekdays);

    // Заполнение таблицы числами
    result.push(emptyLine());
    var activeLine = result.length - 1;
    while (date.month() == monthIndex) {
      result[activeLine][date.weekday()] = { text: date.date(), callback_data: date.format('DD/MM/YYYY') };
      date.add(1, 'days');

      if (date.weekday() == 0 && date.month() == monthIndex) {
        activeLine++;
        result.push(emptyLine());
      }
    }

    return result;
  }

  // Генерирует таблицу для выбора месяца
  getSelection() {

    // Добавление заголовка
    var date = moment(this.today);
    var result = [
      [
        { text: '<', callback_data: 'prev' },
        { text: date.format('MM, YYYY'), callback_data: 'month' },
        { text: '>', callback_data: 'next' }
      ],
    ];

    // Добавление списка месяцев
    var size = 5;
    date.add(-Math.round(size / 2), 'months');

    for (var i = 0; i < size; i++) {
      result.push([{ text: date.format('MMMM, YYYY'), callback_data: date.format('MM, YYYY') }]);
      date.add(1, 'months');
    }

    return result;
  }

  // Создать обработчики событий
  createCallbackQueries() {

    var self = this;
    const prevnext = /prev|next/;
    const selMonth = 'month';
    const month = /\d{2}, \d{4}/;
    self.events = [prevnext, selMonth, month];

    // Выбрана дата, конец работы календаря
    self.emitter.once(/\d{2}\/\d{2}\/\d{4}/, function (data) {

      // Удаление календаря из чата
      self.bot.deleteMessage(self.chatId, self.messageId);

      // Удаление всех обработчиков событий
      self.events.forEach(function (event) {
        self.emitter.removeAllListeners(event);
      });

      // Вызов функции обратного вызова
      self.callback(data);

    });

    // Предыдущий / следующий месяц
    self.emitter.on(prevnext, function (data) {
      var month = parseInt(self.today.month());
      var year = parseInt(self.today.year());

      if (data === 'next')
        month += 2;

      if (month < 1) { month = 12; year--; }
      else if (month > 12) { month = 1; year++; }

      self.today = moment(1 + '/' + month + '/' + year, 'DD/MM/YYYY');

      var opt = self.options();
      opt.chat_id = self.chatId;
      opt.message_id = self.messageId;
      self.bot.editMessageText('Выберите дату:', opt);
    });

    // Открыть меню выбора месяца
    self.emitter.on(selMonth, function () {
      self.mode = 'month selection';

      var opt = self.options();
      opt.chat_id = self.chatId;
      opt.message_id = self.messageId;
      self.bot.editMessageText('Выберите месяц:', opt);
    });

    // Выбран месяц, открыть календарь на текущий месяц
    self.emitter.on(month, function (data) {
      self.mode = 'calendar';
      self.today = moment('1 ' + data, 'DD MM, YYYY');

      var opt = self.options();
      opt.chat_id = self.chatId;
      opt.message_id = self.messageId;
      self.bot.editMessageText('Выберите дату:', opt);
    });

  }

  // Вывод календаря и получение даты
  getDate(callback) {

    var self = this;
    self.callback = callback;

    // Подключение обработчиков событий
    self.bot.on('callback_query', function (callbackQuery) {
      self.bot.answerCallbackQuery(callbackQuery.id).then(function () {
        self.emitter.emit(callbackQuery.data, callbackQuery.data);
      });
    });

    // Вывод виджета календаря в чат
    self.bot.sendMessage(this.chatId, 'Выберите дату:', this.options()).then(function (sender) {
      self.messageId = sender.message_id;
    });

  }

}

module.exports = Calendar;