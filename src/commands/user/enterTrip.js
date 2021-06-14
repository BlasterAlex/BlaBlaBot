const fs = require('fs');
const Emitter = require('pattern-emitter');
const moment = require('moment-timezone');
const puppeteer = require('puppeteer');

// Подключаемые модули
const Calendar = require('../../utils/UI/calendar');
const geocode = require('../../utils/geocode');
const getFullName = require('../../utils/getFullName');
const MessageKeyboard = require('../../utils/UI/messageKeyboard');
const UserRepository = require('../../repositories/UserRepository');

// Установка локали для даты
moment.locale(require('../../../config/config.json').locale);

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
    'quest': 'Выставим ограничение по времени?',
    'varName': 'maximumTime',
    'keys': ['limit', 'огран', 'ограничение']
  },
  {
    'quest': '*Откуда поедем?*\n' + fs.readFileSync('data/messages/enterAddress.txt'),
    'varName': 'from',
    'keys': ['from', 'откуда']
  },
  {
    'quest': '*Куда поедем?*\n' + fs.readFileSync('data/messages/enterAddress.txt'),
    'varName': 'to',
    'keys': ['to', 'куда']
  },
  {
    'quest': 'По какому критерию подбирать поездки?',
    'varName': 'sortBy',
    'keys': ['sort', 'сорт', 'сортировка']
  },
];

// Редактирование запроса или ввод полного запроса
const editTrip = (bot, chatId, editField, callback) => {

  // Подключение обработчиков событий
  const emitter = new Emitter();

  // Событие ввода текста с клавиатуры
  bot.onText(/(.+)/, (msg) => {
    if (msg.from.id === chatId)
      emitter.emit('text', msg.text);
  });


  // Задать вопрос и получить ответ
  const askQuestion = (callback, questNum = 0, answers = {}, onlyOneField = false) => {
    const question = questions[questNum];
    const message = question.quest;

    // Получение валидного времени
    const getValidTime = () => {
      emitter.once('text', function (data) {
        if (data.toLowerCase().trim() === 'отмена')
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

    bot.sendMessage(chatId, message, {
      parse_mode: 'markdown'
    }).then(function (sender) {

      // Текущее сообщение
      const messageId = sender.message_id;

      // Выбор типа вопроса
      switch (question.varName) {

        // Выбор даты
        case 'date': {
          const calendar = new Calendar(bot, chatId);
          calendar.getDate((date) => {

            // Отмена операции
            if (!date)
              return callback(null);

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
          getValidTime();
          break;
        }

        // Ограничение на время
        case 'maximumTime': {
          new MessageKeyboard(bot, chatId, message,
            new Map([
              ['yes', {
                text: 'Да', callback: () => {
                  bot.sendMessage(chatId, 'Введите ограничение в формате *ЧЧ:ММ*', {
                    parse_mode: 'markdown'
                  }).then(function () {
                    getValidTime();
                  });
                }
              }],
              ['no', {
                text: 'Нет', callback: () => {
                  answers[question.varName] = null;
                  if (onlyOneField || questNum == questions.length - 1)
                    return callback(answers);
                  askQuestion(callback, questNum + 1, answers);
                }
              }]
            ]), 'delete', messageId);
          break;
        }

        // Выбор адреса
        case 'from':
        case 'to': {

          // Клавиатура в сообщении
          let keyboard;

          // Обработчик события ввода геопозиции
          bot.on('location', (msg) => {
            if (msg.from.id === chatId)
              emitter.emit('location', msg.location);
          });

          // Удаление всех обработчиков событий
          const removeAllListeners = () => {
            emitter.removeAllListeners('location');
            emitter.removeAllListeners('text');
            if (keyboard) {
              keyboard.remove();
            }
          };

          // Поиск введенного адреса или разбор ссылки
          const findAddress = () => {
            UserRepository.find(chatId, function (users) {
              let user = users[0];

              // История введенных адресов
              const addressHistory = user ? user['addressHistory'] : [];
              if (addressHistory.length) {
                const keymap = new Map();
                addressHistory.forEach((address, index) => {
                  keymap.set('address' + (index + 1), {
                    text: address[0],
                    callback: () => {
                      removeAllListeners();
                      addressFound(address);
                    }
                  });
                });
                keyboard = new MessageKeyboard(bot, chatId, message + '\nИли выберите из списка:', keymap, 'edit', messageId, false);
              }
              answers['addressHistory'] = ('addressHistory' in answers) ? answers['addressHistory'] : addressHistory;

              // Ввод координат с виджета
              emitter.once('location', function (location) {
                removeAllListeners();
                geocode.getAddress(location, res => addressFound(res[0]));
              });

              // Ввод адреса с клавиатуры
              emitter.once('text', function (data) {

                removeAllListeners();

                if (data.toLowerCase() == 'отмена')
                  return callback(null);

                // Поиск адреса по тексту
                const findAddressByText = (data) => { geocode.getGeocode(data, res => addressFound(res[0])); };

                // Поиск адреса по заданным координатам
                const findAddressByLocation = (hostname, location) => {
                  swapCords = hostname.includes('yandex') || hostname.includes('2gis');
                  location = {
                    latitude: parseFloat(swapCords ? location[1] : location[0]),
                    longitude: parseFloat(swapCords ? location[0] : location[1])
                  };
                  geocode.getAddress(location, res => addressFound(res[0]));
                };

                // Поиск ссылки в сообщении
                let match = data.match(/(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/);

                // Найдена ссылка, разбор ссылки
                if (match && match[1]) {

                  const geocodeRegex = /(\d+\.\d+)/g;
                  const link = decodeURI(match[1]);
                  const hostname = new URL(link).hostname;

                  // Поиск координат в ссылке
                  let location = link.match(geocodeRegex);

                  // Найдены координаты в ссылке, поиск адреса
                  if (location && location.length >= 2) {
                    return findAddressByLocation(hostname, location);
                  }

                  // Попытка найти координаты при переходе по ссылке
                  return (async () => {
                    try {

                      // Запустить браузер
                      const browser = await puppeteer.launch({
                        headless: true,
                        defaultViewport: null,
                        args: [
                          '--no-sandbox',
                          '--disable-setuid-sandbox'
                        ]
                      });

                      // Перейти на страницу
                      const page = await browser.newPage();
                      await page.goto(link);

                      // Получить ссылку
                      const curLink = decodeURI(await page.evaluate(() => location.href));

                      // Закрыть браузер
                      browser.close();

                      // Поиск координат в ссылке
                      let location = curLink.match(geocodeRegex);

                      // Найдены координаты в ссылке, поиск адреса
                      if (location && location.length >= 2) {
                        return findAddressByLocation(hostname, location);
                      }

                      // Координаты не найдены 
                      // Разбор адреса
                      findAddressByText(data);

                    } catch (err) {
                      console.error(err);
                      return null;
                    }
                  })();

                }

                // Поиск адреса
                findAddressByText(data);
              });

            });
          };

          // Адрес найден, выполнение действий с результатом
          const addressFound = (result) => {

            // Нет результатов
            if (result === undefined) {
              return bot.sendMessage(chatId, 'Не нашел такого адреса, попробуйте еще раз', {
                parse_mode: 'markdown'
              }).then(() => {
                findAddress();
              });
            }

            const [address, coordinates] = Array.isArray(result) ? result : [
              [result.country, result.state, result.streetName, result.streetNumber]
                .filter(e => e != null)
                .join(', '),
              [result.latitude, result.longitude]
            ];

            bot.sendMessage(chatId, `Найденный адрес: *${address}*`, {
              parse_mode: 'markdown'
            }).then(() => {

              // Формирование ответа
              const answer = [address, coordinates];
              answers[question.varName] = answer;

              // Сохранение адреса в историю
              const addressHistory = answers['addressHistory'].filter(address => address.every((e, i) => e !== answer[i]));
              if (addressHistory.length >= 5) {
                addressHistory.shift();
              }
              addressHistory.push(answer);
              answers['addressHistory'] = addressHistory;

              if (onlyOneField || questNum == questions.length - 1)
                return callback(answers);

              askQuestion(callback, questNum + 1, answers);
            });

          };

          findAddress();
          break;
        }

        // Выбор типа сортировки
        case 'sortBy': {
          new MessageKeyboard(bot, chatId, message,
            new Map([
              ['price', {
                text: 'Цена', callback: () => {
                  bot.sendMessage(chatId, 'Вы выбрали сортировку по цене', {
                    parse_mode: 'markdown'
                  }).then(() => {
                    answers[question.varName] = 'price';
                    if (onlyOneField || questNum == questions.length - 1)
                      return callback(answers);
                    askQuestion(callback, questNum + 1, answers);
                  });
                }
              }],
              ['departure_datetime', {
                text: 'Время', callback: () => {
                  bot.sendMessage(chatId, 'Вы выбрали сортировку по времени', {
                    parse_mode: 'markdown'
                  }).then(() => {
                    answers[question.varName] = 'departure_datetime';
                    if (onlyOneField || questNum == questions.length - 1)
                      return callback(answers);
                    askQuestion(callback, questNum + 1, answers);
                  });
                }
              }],
              ['cancel', { text: 'Отмена', callback: () => { callback(null); } }]
            ]), 'delete', messageId);
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
        user['addressHistory'] = answers['addressHistory'];
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