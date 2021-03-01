// Вывод информации о пользователе
module.exports = function (bot, chatId) {
  require('../../utils/getFullName')(bot, chatId, (userName) => {
    bot.sendMessage(chatId, `Привет, ${userName}`, {
      parse_mode: 'markdown'
    });
  });
};