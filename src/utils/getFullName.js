// Получение полного имени пользователя
module.exports = (bot, chatId, callback) => {
  (async () => {
    return await bot.getChatMember(chatId, chatId)
      .then((chat) => {
        let fullName = chat.user.first_name;
        if (chat.user.last_name)
          fullName += ' ' + chat.user.last_name;
        return fullName;
      })
      .catch((e) => {
        if (e.response.body.error_code == 400)
          console.error('Пользователь с id ' + chatId + ' не найден');
      });
  })()
    .then(callback);
};