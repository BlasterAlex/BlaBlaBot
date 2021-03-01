const TelegramBot = require('node-telegram-bot-api');

// Подключаемые модули
const comParser = require('./commands/parser');

// Настройки подключения и запуск бота
var bot;
if (process.env.TELEGRAM_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
  // bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new TelegramBot(require('../config/private.json').TELEGRAM_TOKEN, {
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

// Обработка сообщений
bot.onText(/(.+)/, (msg) => {
  comParser(bot, msg);
});

// Вывод ошибок
bot.on('polling_error', (err) => console.error(err));


module.exports = { bot };
