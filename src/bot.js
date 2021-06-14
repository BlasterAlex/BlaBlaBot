const TelegramBot = require('node-telegram-bot-api');
const commandParser = require('./commands/parser');
const cronJobs = require('./utils/cronJobs');

// Настройки подключения и запуск бота
var bot;
if (process.env.TELEGRAM_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_TOKEN);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
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

// Фоновые события по таймеру
cronJobs.createAll(bot);

// Обработка сообщений
bot.onText(/(.+)/, (msg) => {
  commandParser(bot, msg);
});

// Вывод ошибок
bot.on('polling_error', (err) => console.error(err));

module.exports = { bot };
