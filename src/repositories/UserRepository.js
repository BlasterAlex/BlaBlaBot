var User = require('../models/User');

module.exports.getAll = callback => {
  User.find({}, (err, list) => {
    if (err)
      return console.error(err);
    callback(list);
  });
};

module.exports.find = (chatId, callback) => {
  User.find({ _id: chatId }, (err, user) => {
    if (err)
      return console.error(err);
    callback(user);
  });
};

module.exports.save = (chatId, data, callback) => {
  User.findOneAndUpdate({ _id: chatId }, data, { upsert: true }, function (err, res) {
    if (err)
      return console.error(err);
    callback();
  });
};