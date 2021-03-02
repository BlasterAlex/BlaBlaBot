const fs = require('fs');
const Emitter = require('pattern-emitter');
const moment = require('moment-timezone');

// Подключаемые модули
const Calendar = require('../../utils/calendar');
const geocode = require('../../utils/geocode');
const getFullName = require('../../utils/getFullName');
const UserRepository = require('../../repositories/UserRepository');

// Установка локали календаря
const config = require('../../../config/config.json');
moment.locale(config.locale);

// Вопросы пользователю
const questions = [
  {
    'quest': 'Дата поездки',
    'varName': 'date',
    'keys': ['date', 'дата']
  },
  {
    'quest': 'Время поездки в формате *ЧЧ:ММ*',
    'varName': 'time',
    'keys': ['time', 'время']
  },
  {
    'quest': 'Откуда поедем?\n' + fs.readFileSync('data/messages/enterAddress.txt'),
    'varName': 'from',
    'keys': ['from', 'откуда']
  },
  {
    'quest': 'Куда поедем?\n' + fs.readFileSync('data/messages/enterAddress.txt'),
    'varName': 'to',
    'keys': ['to', 'куда']
  }
];

// Редактирование запроса или ввод полного запроса
const editTrip = (bot, chatId, editField, callback) => {

  // Подключение обработчиков событий
  const emitter = new Emitter();
  bot.onText(/(.+)/, (msg) => {
    emitter.emit('text', msg.text);
  });
  bot.on('location', (msg) => {
    emitter.emit('location', msg.location);
  });

  // Задать вопрос и получить ответ
  const askQuestion = (callback, questNum = 0, answers = {}, onlyOneField = false) => {
    const question = questions[questNum];
    bot.sendMessage(chatId, question.quest, {
      parse_mode: 'markdown'
    }).then(function () {
      switch (question.varName) {
        // Выбор даты
        case 'date': {
          const calendar = new Calendar(bot, chatId);
          calendar.getDate((date) => {
            const mDate = moment(date, 'DD/MM/YYYY');
            bot.sendMessage(chatId, `Вы ввели: *${mDate.format('DD.MM.YYYY')}*`, {
              parse_mode: 'markdown'
            }).then(() => {
              answers[question.varName] = mDate.format('YYYY-MM-DD');

              if (onlyOneField || questNum == questions.length - 1)
                return callback(answers);

              askQuestion(callback, questNum + 1, answers);
            });
          });
          break;
        }

        // Ввод времени
        case 'time': {

          // Получение валидного времени
          const getValidTime = () => {
            emitter.once('text', function (data) {
              if (data.toLowerCase() == 'отмена')
                return callback(null);

              const time = moment(data, 'HH:mm', true);
              if (!time.isValid()) {
                return bot.sendMessage(chatId, 'Неправильный формат времени, попробуйте еще раз', {
                  parse_mode: 'markdown'
                }).then(() => {
                  getValidTime();
                });
              }

              answers[question.varName] = time.format('HH:mm:ss');

              if (onlyOneField || questNum == questions.length - 1)
                return callback(answers);

              askQuestion(callback, questNum + 1, answers);

            });
          };

          getValidTime();

          break;
        }

        // Выбор адреса
        case 'from':
        case 'to': {

          // Поиск введенного адреса
          const findAddress = () => {

            // Ввод координат с виджета
            emitter.once('location', function (location) {
              emitter.removeAllListeners('text');
              geocode.getAddress(location, (res) => {

                // Нет результатов
                if (res[0] === undefined) {
                  return bot.sendMessage(chatId, 'Не нашел такого адреса, попробуйте еще раз', {
                    parse_mode: 'markdown'
                  }).then(() => {
                    findAddress();
                  });
                }

                const result = res[0];
                const address =
                  [result.country, result.state, result.streetName, result.streetNumber]
                    .filter(e => e != null)
                    .join(', ');

                bot.sendMessage(chatId, `Найденный адрес: *${address}*`, {
                  parse_mode: 'markdown'
                }).then(() => {
                  answers[question.varName] = [
                    address,
                    [location.latitude, location.longitude]
                  ];

                  if (onlyOneField || questNum == questions.length - 1)
                    return callback(answers);

                  askQuestion(callback, questNum + 1, answers);
                });
              });
            });

            // Ввод адреса с клавиатуры
            emitter.once('text', function (data) {

              emitter.removeAllListeners('location');
              if (data.toLowerCase() == 'отмена')
                return callback(null);

              // Поиск ссылки в сообщении
              let match = data.match(/(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/);
              if (match[1]) {
                const link = decodeURI(match[1]);
                const hostname = new URL(link).hostname;

                // Поиск координат в ссылке
                let location = link.match(/(\d+\.\d+)/g);

                // Найденны координаты, поиск адреса
                if (location && location.length >= 2) {

                  // Яндекс очень странный
                  location = {
                    latitude: parseFloat(hostname === 'yandex.ru' ? location[1] : location[0]),
                    longitude: parseFloat(hostname === 'yandex.ru' ? location[0] : location[1])
                  };

                  return geocode.getAddress(location, (res) => {

                    // Нет результатов
                    if (res[0] === undefined) {
                      return bot.sendMessage(chatId, 'Не нашел такого адреса, попробуйте еще раз', {
                        parse_mode: 'markdown'
                      }).then(() => {
                        findAddress();
                      });
                    }

                    const result = res[0];
                    const address =
                      [result.country, result.state, result.streetName, result.streetNumber]
                        .filter(e => e != null)
                        .join(', ');

                    bot.sendMessage(chatId, `Найденный адрес: *${address}*`, {
                      parse_mode: 'markdown'
                    }).then(() => {
                      answers[question.varName] = [
                        address,
                        [location.latitude, location.longitude]
                      ];

                      if (onlyOneField || questNum == questions.length - 1)
                        return callback(answers);

                      askQuestion(callback, questNum + 1, answers);
                    });
                  });
                }
              }

              // Поиск адреса
              geocode.getGeocode(data, (res) => {

                // Нет результатов
                if (res[0] === undefined) {
                  return bot.sendMessage(chatId, 'Не нашел такого адреса, попробуйте еще раз', {
                    parse_mode: 'markdown'
                  }).then(() => {
                    findAddress();
                  });
                }

                const result = res[0];
                const address =
                  [result.country, result.state, result.streetName, result.streetNumber]
                    .filter(e => e != null)
                    .join(', ');

                bot.sendMessage(chatId, `Найденный адрес: *${address}*`, {
                  parse_mode: 'markdown'
                }).then(() => {

                  answers[question.varName] = [
                    address,
                    [result.latitude, result.longitude]
                  ];

                  if (onlyOneField || questNum == questions.length - 1)
                    return callback(answers);

                  askQuestion(callback, questNum + 1, answers);
                });

              });
            });

          };

          findAddress();
          break;
        }
      }
    });
  };

  // Если введено поле для редактирования
  if (editField) {
    return askQuestion(answers => {
      if (!answers)
        return callback(answers);
      UserRepository.find(chatId, users => {
        let user = users[0];
        user[editField.varName] = answers[editField.varName];
        UserRepository.save(chatId, user, () => {
          callback(user);
        });
      });
    }, questions.indexOf(editField), {}, true);
  }

  // Формирование полного запроса
  bot.sendMessage(chatId, fs.readFileSync('data/messages/enterTrip.txt'), {
    parse_mode: 'markdown'
  }).then(askQuestion(answers => {
    if (!answers)
      return callback(answers);
    getFullName(bot, chatId, fullName => {
      answers.fullName = fullName;
      UserRepository.save(chatId, answers, () => {
        callback(answers);
      });
    });
  }));
};

// Ввод нужной поездки пользователем
module.exports = function (bot, chatId, varName, callback) {

  // Поле для редактирования
  let editField = null;

  // Проверка введенного параметра
  varName = varName.toLowerCase();
  if (varName != 'all') {

    // Введено неправильное имя
    if (!questions.filter(q => q.keys.includes(varName)).length) {
      let keys = [];
      questions.forEach(q => {
        keys.push('- ' + q.keys.join(', '));
      });
      return callback(fs.readFileSync('data/messages/editHelp.txt') +
        '\n\nДоступный список имен:\n' + keys.join('\n'), 400);
    }

    // Выбор поля для редактирования
    editField = questions.filter(q => q.keys.includes(varName))[0];

    // Проверка наличия записи в бд
    return UserRepository.find(chatId, users => {
      if (!users.length)
        return callback(fs.readFileSync('data/messages/editNoEntity.txt'), 404);
      editTrip(bot, chatId, editField, callback);
    });
  }

  // Редактирование запроса или ввод полного запроса
  editTrip(bot, chatId, editField, callback);
};