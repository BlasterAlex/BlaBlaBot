const fetch = require('node-fetch');
const express = require('express');
const bodyParser = require('body-parser');
const packageInfo = require('../package.json');

const app = express();
app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.json({ version: packageInfo.version });
});

var server = app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
  const host = server.address().address;
  const port = server.address().port;
  console.log('Web server started at http://%s:%s', host, port);
});

// Держать бота активным
if (process.env.HEROKU_URL) {

  const interval = 15 * 60 * 1000; // interval in milliseconds - 15 mins
  (function wake(url) {
    var handler;
    try {
      handler = setInterval(() => {
        fetch(url)
          .then(res => console.log('Ping heroku: ' + (res.ok ? 'OK' : 'NOT OK') + ` status: ${res.status}`))
          .catch(err => console.error(`Ping heroku error: ${err}`));
      }, interval);
    } catch (err) {
      console.error('Ping heroku error: retrying...');
      clearInterval(handler);
      return setTimeout(() => wake(url), 10000);
    }
  })(process.env.HEROKU_URL);

}

module.exports = (bot) => {
  app.post('/' + bot.token, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
};
