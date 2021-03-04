const fs = require('fs');
const Emitter = require('pattern-emitter');
const moment = require('moment-timezone');
const puppeteer = require('puppeteer');

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
  },
  {
    'quest': 'По какому критерию подбирать поездки?',
    'varName': 'sortBy',
    'keys': ['sort', 'сорт', 'сортировка']
  }
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
    bot.sendMessage(chatId, question.quest, {
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

          // Обработчик события ввода геопозиции
          bot.on('location', (msg) => {
            if (msg.from.id === chatId)
              emitter.emit('location', msg.location);
          });

          // Поиск введенного адреса или разбор ссылки
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

              // Поиск адреса по тексту
              const findAddressByText = (data) => {
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
              };

              // Поиск адреса по заданным координатам
              const findAddressByLocation = (hostname, location) => {

                // Яндекс очень странный
                location = {
                  latitude: parseFloat(hostname === 'yandex.ru' ? location[1] : location[0]),
                  longitude: parseFloat(hostname === 'yandex.ru' ? location[0] : location[1])
                };

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

                // Найденны координаты в ссылке, поиск адреса
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

                    // Найденны координаты в ссылке, поиск адреса
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

          };

          findAddress();
          break;
        }

        // Сортировка
        case 'sortBy': {

          // Вывод вопроса пользователю
          const price = 'price';
          const departure_datetime = 'departure_datetime';
          const cancel = 'cancel';
          bot.editMessageText(question.quest, {
            chat_id: chatId,
            message_id: sender.message_id,
            parse_mode: 'markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Цена', callback_data: price },
                  { text: 'Время', callback_data: departure_datetime },
                  { text: 'Отмена', callback_data: cancel }
                ]
              ]
            }
          }).then(function () {

            // Подключение обработчиков событий
            const emitter = new Emitter();
            bot.on('callback_query', function (callbackQuery) {
              if (callbackQuery.from.id === chatId)
                bot.answerCallbackQuery(callbackQuery.id).then(function () {
                  emitter.emit(callbackQuery.data, callbackQuery.data);
                });
            });

            // Удаление клавиатуры и обработчиков событий
            const events = [price, departure_datetime, cancel];
            const dropInlineKeyboard = (callback) => {
              bot.deleteMessage(chatId, messageId);
              events.forEach(function (event) {
                emitter.removeAllListeners(event);
              });
              callback();
            };

            // События выбора пользователя
            emitter.on(price, function () {
              dropInlineKeyboard(() => {
                return bot.sendMessage(chatId, 'Вы выбрали сортировку по цене', {
                  parse_mode: 'markdown'
                }).then(() => {
                  answers[question.varName] = 'price';
                  if (onlyOneField || questNum == questions.length - 1)
                    return callback(answers);
                  askQuestion(callback, questNum + 1, answers);
                });
              });
            });
            emitter.on(departure_datetime, function () {
              dropInlineKeyboard(() => {
                return bot.sendMessage(chatId, 'Вы выбрали сортировку по времени', {
                  parse_mode: 'markdown'
                }).then(() => {
                  answers[question.varName] = 'departure_datetime';
                  if (onlyOneField || questNum == questions.length - 1)
                    return callback(answers);
                  askQuestion(callback, questNum + 1, answers);
                });
              });
            });
            emitter.on(cancel, function () {
              dropInlineKeyboard(() => {
                callback(null);
              });
            });
          });
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