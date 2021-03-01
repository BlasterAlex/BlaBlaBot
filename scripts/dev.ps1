# Переключение бота в режим разработки
get-content .\config\private.json | Where-Object { $_ -match '^\s*\"TELEGRAM_TOKEN\":\s*\"(.*)\"' } | out-null
$Token = $Matches.1
Invoke-WebRequest https://api.telegram.org/bot$Token/setWebhook?url=