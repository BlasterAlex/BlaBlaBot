const TelegramBot = require('node-telegram-bot-api');
const commandParser = require('./commands/parser');
const cronJob = require('./utils/cronJob');

// Настройки подключения и запуск бота
var bot;
if (process.env.TELEGRAM_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_TOKEN);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new TelegramBot(require('../config/env.json').TELEGRAM_TOKEN, {
    polling: true,
    request: {
      agentClass: require('socks5-https-client/lib/Agent'),
      agentOptions: {
        socksHost: '127.0.0.1',
        socksPort: '9050'
      }
    }
  });
}
console.log('Bot server started in the ' + (process.env.NODE_ENV || 'development') + ' mode');

// Фоновые события по таймеру
cronJob.createAll(bot);

// Вызов глобального обработчика текста
const emitTextEvent = (chatId, message) => {
  commandParser(bot, chatId, message);
};

// Обработка сообщений
bot.onText(/(.+)/, (msg) => {
  emitTextEvent(msg.chat.id, msg.text);
});

// Вывод ошибок
bot.on('polling_error', console.error);

module.exports = { bot, emitTextEvent };
