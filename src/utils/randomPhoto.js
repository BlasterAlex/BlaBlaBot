const fs = require('fs');

module.exports.fromDir = (dirPath) => {
  const images = fs.readdirSync(dirPath).map(file => dirPath + '/' + file);
  return images[Math.floor(Math.random() * images.length)];
};