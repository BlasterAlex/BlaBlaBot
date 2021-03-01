# Установка webHook для приложения
get-content .\config\private.json | Where-Object { $_ -match '^\s*\"TELEGRAM_TOKEN\":\s*\"(.*)\"' } | out-null
$Token = $Matches.1
$HerokuApp = 'https://bla-bla-bot.herokuapp.com'
Invoke-WebRequest https://api.telegram.org/bot$Token/setWebhook?url=$HerokuApp