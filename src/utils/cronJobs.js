const fs = require('fs');
const CronJob = require('cron').CronJob;
const UserRepository = require('../repositories/UserRepository');
const config = require('../../config/config.json');
const bestTrips = require('./bestTrips');
const randomPhoto = require('./randomPhoto');

// Список cron-задач
var cronJobsMap = new Map();

// Таймер для cron задач
const cronMinutes = 1;

// Создание cron-задач на основе информации из БД (запускается при старте сервера)
const createAll = (bot) => {
  UserRepository.getAll(users => {
    users = users.filter(user => user.searchTrips);
    let left = users.length;

    // Проход по пользовательским задачам
    new Promise((resolve) => {
      users.forEach((user) => {

        // Идентификатор пользователя
        const chatId = parseInt(user._id);
        console.log(`Cronjob for user ${chatId}`);

        // Создание объекта для пользователя
        cronJobsMap.set(chatId.toString(), new CronJob(`*/${cronMinutes} * * * *`,
          () => bestTrips.research(bot, chatId), null, true, config.timeZone));

        // Изменение счетчика
        if (--left === 0) resolve();

      });
      if (left === 0) resolve();

    }).then(() => console.log('CronJobs installed successfully'));
  });
};

// Создание новой cron задачи (запускается пользователем)
const create = (bot, chatId, results) => {
  UserRepository.find(chatId, users => {
    let user = users[0];
    user['searchTrips'] = true;
    user['savedResult'] = results;
    UserRepository.save(chatId, user, () => {

      const key = chatId.toString();
      if (cronJobsMap.has(key)) {
        cronJobsMap.get(key).stop();
        cronJobsMap.delete(key);
      }
      cronJobsMap.set(key, new CronJob(`${cronMinutes} * * * *`,
        () => bestTrips.research(bot, chatId), null, true, config.timeZone));

      // Отправить сообщение с случайной картинкой
      const image = randomPhoto.fromDir('data/images/cronCreate');
      const imageExt = image.split('.').pop();
      bot.sendPhoto(chatId, fs.readFileSync(image), {
        caption: fs.readFileSync('data/messages/cronCreate.txt'),
        filename: 'cron-create',
        contentType: 'image/' + imageExt
      });

    });
  });
};

// Удаление cron задачи (запускается пользователем)
const remove = (bot, chatId) => {
  UserRepository.find(chatId, users => {
    let user = users[0];
    user['searchTrips'] = false;
    user['savedResult'] = [];
    UserRepository.save(chatId, user, () => {
      const key = chatId.toString();
      if (cronJobsMap.has(key)) {
        cronJobsMap.get(key).stop();
        cronJobsMap.delete(key);
        bot.sendMessage(chatId, fs.readFileSync('data/messages/cronRemove.txt'), {
          parse_mode: 'markdown'
        });
      }
    });
  });
};

module.exports = { createAll, create, remove };