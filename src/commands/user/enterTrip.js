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
    'varName': 'date'
  },
  {
    'quest': 'Время поездки в формате *ЧЧ:ММ*',
    'varName': 'time'
  },
  {
    'quest': 'Откуда поедем?',
    'varName': 'from'
  },
  {
    'quest': 'Куда поедем?',
    'varName': 'to'
  }
];

// Ввод нужной поездки пользователем
module.exports = function (bot, chatId, callback) {

  // Подключение обработчиков событий
  const emitter = new Emitter();
  bot.onText(/(.+)/, (msg) => {
    emitter.emit(msg.text, msg.text);
  });

  // Задать вопрос и получить ответ
  const askQuestion = (callback, questNum = 0, answers = {}) => {
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
              if (questNum == questions.length - 1)
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
            emitter.once(/(.+)/, function (data) {
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

              if (questNum == questions.length - 1)
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
            emitter.once(/(.+)/, function (data) {
              if (data.toLowerCase() == 'отмена')
                return callback(null);

              // Поиск адреса
              geocode(data, (res) => {

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

                  if (questNum == questions.length - 1)
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

  // Формирование поездки
  bot.sendMessage(chatId, fs.readFileSync('data/messages/enterTrip.txt'), {
    parse_mode: 'markdown'
  }).then(askQuestion(answers => {
    getFullName(bot, chatId, fullName => {
      answers.fullName = fullName;
      UserRepository.save(chatId, answers, () => {
        callback(answers);
      });
    });
  }));
};