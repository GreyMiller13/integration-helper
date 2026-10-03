# Шпаргалка curl

curl — консольный HTTP-клиент, который есть почти на любой машине. Для аналитика это универсальный способ воспроизвести запрос, приложить его к задаче или письму партнёру и быстро проверить гипотезу без GUI. Здесь собраны флаги и приёмы, которые реально нужны при работе с интеграциями.

::: info Версия имеет значение
Часть флагов появилась сравнительно недавно (например, `--json` — в curl 7.82.0, `--fail-with-body` — в 7.76.0). Проверьте свою версию: `curl --version`. Полная справка — `curl --help all` или `man curl`.
:::

## Базовый запрос {#basic}

```bash
# GET — метод по умолчанию. Выводится только тело ответа
curl https://api.example.com/v1/orders/42

# URL с параметрами берите в кавычки: & и ? — спецсимволы оболочки
curl "https://api.example.com/v1/orders?status=new&limit=20"

# Параметры можно собрать через -G и --data-urlencode (curl сам закодирует пробелы, кириллицу и т. п.)
curl -G https://api.example.com/v1/orders \
  --data-urlencode "status=new" \
  --data-urlencode "customer=Иванов Иван"
```

## Посмотреть ответ целиком {#inspect}

| Флаг | Что делает |
|---|---|
| `-i`, `--include` | Выводит заголовки ответа вместе с телом |
| `-I`, `--head` | Отправляет `HEAD` — только заголовки, без тела |
| `-v`, `--verbose` | Подробный лог: DNS, соединение, TLS, заголовки запроса и ответа |
| `--trace-ascii файл` | Полный дамп обмена, включая тела запроса и ответа. `-` вместо имени файла — вывод в консоль |

```bash
# Статус и заголовки + тело
curl -i https://api.example.com/v1/orders/42

# Только заголовки (метод HEAD — сервер может отвечать на него иначе, чем на GET!)
curl -I https://api.example.com/v1/orders/42

# Заголовки ответа на GET без тела: тело в никуда, заголовки — в консоль
curl -s -o /dev/null -D - https://api.example.com/v1/orders/42

# Подробный лог соединения
curl -v https://api.example.com/v1/orders/42

# Полный дамп, включая тело запроса, — когда надо доказать, что именно ушло на сервер
curl --trace-ascii - -H "Content-Type: application/json" \
  -d '{"customerId":"c-1001"}' https://api.example.com/v1/orders
```

::: warning Секреты в логах
`-v` и `--trace-ascii` печатают заголовок `Authorization`, cookies и тела. Перед тем как вставить вывод в задачу или чат — замаскируйте токены.
:::

## Методы {#methods}

```bash
curl -X POST   https://api.example.com/v1/orders -d '...'
curl -X PUT    https://api.example.com/v1/orders/42 -d '...'
curl -X PATCH  https://api.example.com/v1/orders/42 -d '...'
curl -X DELETE https://api.example.com/v1/orders/42
curl -X OPTIONS -i https://api.example.com/v1/orders
```

::: tip -X часто не нужен
`-d`, `--json` и `-F` сами переключают метод на `POST`, `-I` — на `HEAD`. Лишний `-X POST` не вредит, но `-X` вместе с `-L` (редиректы) может дать неожиданный результат: curl будет использовать указанный метод и после редиректа.
:::

Подробнее о семантике методов — [Методы HTTP](/http/methods).

## Заголовки {#headers}

```bash
curl https://api.example.com/v1/orders/42 \
  -H "Accept: application/json" \
  -H "X-Request-ID: 3f2b8c1e-7a4d-4e8b-9c2a-1d5e6f7a8b9c" \
  -H "Accept-Language: ru"

# Убрать заголовок, который curl добавляет сам (например, User-Agent)
curl -H "User-Agent:" https://api.example.com/v1/ping

# Отправить заголовок с пустым значением — точка с запятой вместо двоеточия
curl -H "X-Empty;" https://api.example.com/v1/ping

# Заголовки из файла (по одному на строку), curl 7.55+
curl -H @headers.txt https://api.example.com/v1/orders
```

См. также [Заголовки HTTP](/http/headers).

## Тело запроса: JSON {#json}

```bash
# -d: тело как есть. ВНИМАНИЕ: по умолчанию Content-Type будет application/x-www-form-urlencoded
curl https://api.example.com/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"c-1001","items":[{"sku":"SKU-1","quantity":2}]}'

# --json (curl 7.82+): ставит Content-Type и Accept = application/json и отправляет POST
curl --json '{"customerId":"c-1001"}' https://api.example.com/v1/orders

# Тело из файла. --data-binary отправляет файл байт в байт
curl https://api.example.com/v1/orders \
  -H "Content-Type: application/json" \
  --data-binary @order.json

# --json тоже умеет читать файл
curl --json @order.json https://api.example.com/v1/orders

# Тело из stdin
cat order.json | curl --json @- https://api.example.com/v1/orders

# --data-raw: символ @ в начале НЕ означает файл
curl -H "Content-Type: application/json" \
  --data-raw '{"email":"@ivanov"}' https://api.example.com/v1/users
```

::: danger Три частые ошибки с телом
1. **Забыли `Content-Type`.** С флагом `-d` curl отправит `Content-Type: application/x-www-form-urlencoded`, и сервер вернёт [415](/http/status-codes#415) или [400](/http/status-codes#400). Используйте `--json` или явный `-H "Content-Type: application/json"`.
2. **`-d @file` вместо `--data-binary @file`.** `-d` при чтении из файла выкидывает переводы строк — для JSON обычно не страшно, но для XML, CSV или подписанного тела (HMAC) — сломает данные.
3. **Кавычки.** В bash JSON берут в одинарные кавычки. В Windows всё иначе — см. [Особенности Windows](#windows).
:::

## Тело запроса: формы {#forms}

```bash
# application/x-www-form-urlencoded: несколько -d склеиваются через &
curl https://api.example.com/v1/login -d "username=ivanov" -d "password=secret"

# --data-urlencode кодирует значение (пробелы, &, =, кириллица)
curl https://api.example.com/v1/search --data-urlencode "q=заказ №42 & доставка"

# multipart/form-data: загрузка файла
curl https://api.example.com/v1/documents \
  -F "file=@contract.pdf;type=application/pdf" \
  -F "title=Договор 42" \
  -F 'meta={"category":"contract"};type=application/json'

# Задать имя файла, отличное от локального
curl https://api.example.com/v1/documents -F "file=@./tmp/x.pdf;filename=contract.pdf"
```

`-F` сам выставит `Content-Type: multipart/form-data` с параметром `boundary` — не задавайте этот заголовок вручную, иначе boundary потеряется.

## Авторизация {#auth}

```bash
# Basic: curl сам закодирует логин:пароль в Base64
curl -u "integration-user:s3cret" https://api.example.com/v1/orders

# Только логин — пароль curl спросит интерактивно и он не попадёт в историю команд
curl -u "integration-user" https://api.example.com/v1/orders

# Bearer-токен через заголовок
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/v1/orders

# Bearer-токен через специальный флаг
curl --oauth2-bearer "$TOKEN" https://api.example.com/v1/orders

# API-ключ в заголовке
curl -H "X-API-Key: $API_KEY" https://api.example.com/v1/orders
```

::: tip Не светите секреты в истории
Храните токены в переменных окружения (`export TOKEN=...`), а не вставляйте их в команду целиком: команды сохраняются в истории оболочки и видны в списке процессов.
:::

Подробнее — [Аутентификация](/security/authentication).

## Токен OAuth 2.0 Client Credentials {#oauth-client-credentials}

Типичный сценарий межсервисной интеграции: получить access token у сервера авторизации и вызвать API.

```bash
# 1. Получить токен (client_secret_basic — client_id и secret в заголовке Basic)
TOKEN=$(curl -sS -f https://auth.example.com/oauth2/token \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  -d "scope=orders.read orders.write" \
  | jq -r '.access_token')

# Вариант client_secret_post — client_id и secret в теле запроса
TOKEN=$(curl -sS -f https://auth.example.com/oauth2/token \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode "client_secret=$CLIENT_SECRET" \
  --data-urlencode "scope=orders.read" \
  | jq -r '.access_token')

# 2. Использовать токен
curl -sS -H "Authorization: Bearer $TOKEN" https://api.example.com/v1/orders | jq .

# Посмотреть, что внутри токена (если это JWT), — локально, без сайтов
echo "$TOKEN" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | jq .
```

Какой способ передачи секрета (`client_secret_basic` или `client_secret_post`) принимает сервер — смотрите в его документации или в метаданных `/.well-known/openid-configuration` (поле `token_endpoint_auth_methods_supported`). Подробнее — [OAuth 2.0 и OpenID Connect](/security/oauth2).

## Cookies {#cookies}

```bash
# Отправить cookie
curl -b "session=abc123; lang=ru" https://app.example.com/api/profile

# Сохранить cookies из ответа в файл
curl -c cookies.txt -d "login=ivanov&password=secret" https://app.example.com/login

# Использовать сохранённые cookies (и обновлять файл)
curl -b cookies.txt -c cookies.txt https://app.example.com/api/profile
```

## Редиректы {#redirects}

```bash
# По умолчанию curl НЕ следует редиректам — вы увидите 301/302 и заголовок Location
curl -i https://api.example.com/v1/old-endpoint

# Следовать редиректам (не более 5)
curl -L --max-redirs 5 https://api.example.com/v1/old-endpoint
```

::: warning Редиректы и POST
При ответах [301](/http/status-codes#301), [302](/http/status-codes#302) и [303](/http/status-codes#303) curl с `-L` превращает `POST` в `GET` и теряет тело — так ведут себя и браузеры. Сохраняют метод коды [307](/http/status-codes#307) и [308](/http/status-codes#308). Заголовок `Authorization` (и учётные данные из `-u`) при редиректе на другой хост curl не передаёт — это защита от утечки токена.
:::

## Таймауты {#timeouts}

```bash
# Не дольше 5 секунд на установку соединения, не дольше 30 секунд на весь запрос
curl --connect-timeout 5 -m 30 https://api.example.com/v1/reports/heavy

# -m и --max-time — одно и то же; значения можно задавать дробными
curl --max-time 2.5 https://api.example.com/v1/ping
```

По умолчанию у curl **нет** общего таймаута на запрос — зависший сервер может держать соединение бесконечно. В скриптах всегда задавайте `-m`. При срабатывании таймаута curl завершается с кодом 28. См. [Таймауты и повторы](/reliability/timeouts-retries).

## Повторы {#retries}

```bash
# До 3 повторов при «временных» ошибках: таймаут, 408, 429, 500, 502, 503, 504
curl --retry 3 https://api.example.com/v1/orders/42

# Фиксированная пауза 2 секунды между попытками и общий лимит времени на повторы
curl --retry 5 --retry-delay 2 --retry-max-time 60 https://api.example.com/v1/orders/42

# Повторять при любой ошибке (curl 7.71+), в том числе при отказе в соединении
curl --retry 3 --retry-all-errors https://api.example.com/v1/orders/42
```

Без `--retry-delay` curl использует экспоненциальную паузу: 1 секунда, затем удвоение. Если сервер прислал заголовок `Retry-After`, curl его учитывает.

::: danger Повторы небезопасных запросов
`--retry` с `POST` может создать дубль: сервер обработал запрос, а ответ потерялся по дороге. Повторяйте `POST` только если API поддерживает ключ идемпотентности (`Idempotency-Key`), — см. [Идемпотентность](/design/idempotency).
:::

## Сертификаты и TLS {#tls}

```bash
# Доверять корпоративному/тестовому CA (например, внутреннему удостоверяющему центру)
curl --cacert corp-root-ca.pem https://api.internal.example.com/v1/ping

# mTLS: клиентский сертификат и закрытый ключ
curl --cert client.crt --key client.key https://partner.example.com/api/v1/ping

# Ключ защищён паролем
curl --cert client.crt --key client.key --pass "$KEY_PASSWORD" https://partner.example.com/api/v1/ping

# Сертификат в формате PKCS#12 (.p12/.pfx) — поддержка зависит от TLS-библиотеки сборки curl
curl --cert-type P12 --cert client.p12:"$P12_PASSWORD" https://partner.example.com/api/v1/ping

# Отключить проверку сертификата сервера — ТОЛЬКО для локальной отладки
curl -k https://localhost:8443/v1/ping
```

::: danger Почему -k нельзя в проде
`-k` (`--insecure`) отключает проверку, что сертификат выдан доверенным центром и соответствует имени хоста. Соединение остаётся зашифрованным, но вы не знаете, **с кем** оно установлено: любой, кто встал посередине (прокси, подменённый DNS, Wi-Fi в кафе), прочитает и изменит трафик, включая токены. Если «без `-k` не работает» — значит не хватает корневого сертификата: добавьте его через `--cacert` или в системное хранилище. Аналоги `-k` в коде (`verify=False`, «доверять всем сертификатам») — частая находка аудита безопасности.
:::

Подробнее — [TLS и mTLS](/security/tls).

## Прокси {#proxy}

```bash
# Через HTTP-прокси
curl -x http://proxy.corp.example.com:3128 https://api.partner.com/v1/ping

# С авторизацией на прокси
curl -x http://proxy.corp.example.com:3128 -U "login:password" https://api.partner.com/v1/ping

# Через переменные окружения (их понимает и curl, и многие другие инструменты)
export HTTPS_PROXY=http://proxy.corp.example.com:3128
export NO_PROXY=localhost,.internal.example.com

# Проигнорировать прокси для конкретного запроса
curl --noproxy "*" https://api.internal.example.com/v1/ping
```

## Сохранение ответа {#output}

```bash
# Тело — в файл с заданным именем
curl -o report.json https://api.example.com/v1/reports/42

# Тело — в файл с именем из URL (тут: export.csv)
curl -O https://files.example.com/exports/export.csv

# Имя файла из заголовка Content-Disposition
curl -OJ https://api.example.com/v1/documents/42/content

# Заголовки ответа — в отдельный файл, тело — в другой
curl -D headers.txt -o body.json https://api.example.com/v1/orders/42
```

## Метрики ответа через -w {#write-out}

Флаг `-w` (`--write-out`) печатает после запроса значения переменных: код ответа, время этапов, размер.

```bash
# Только код ответа
curl -s -o /dev/null -w "%{http_code}\n" https://api.example.com/v1/ping

# Разбивка по времени (в секундах)
curl -s -o /dev/null https://api.example.com/v1/orders/42 -w "\
code:           %{http_code}\n\
dns:            %{time_namelookup}\n\
connect:        %{time_connect}\n\
tls:            %{time_appconnect}\n\
first byte:     %{time_starttransfer}\n\
total:          %{time_total}\n\
size:           %{size_download} bytes\n\
remote ip:      %{remote_ip}\n"
```

Как читать: каждое значение — время **от начала запроса** до окончания этапа, а не длительность этапа.

| Переменная | До какого момента |
|---|---|
| `time_namelookup` | DNS-имя разрешено |
| `time_connect` | TCP-соединение установлено |
| `time_appconnect` | TLS-рукопожатие завершено (0 для HTTP) |
| `time_starttransfer` | Получен первый байт ответа (TTFB). Разница с `time_appconnect` ≈ время обработки на сервере |
| `time_total` | Ответ получен полностью |

Формат удобно хранить в файле и подключать через `-w "@curl-format.txt"`. Начиная с curl 7.70 есть `-w "%{json}"` — все метрики одним JSON-объектом.

```bash
# Замер 10 запросов подряд: код и общее время
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code} %{time_total}\n" https://api.example.com/v1/ping
done
```

## Тихий режим и ошибки {#fail}

| Флаг | Что делает |
|---|---|
| `-s`, `--silent` | Без индикатора прогресса и сообщений об ошибках |
| `-S`, `--show-error` | Вместе с `-s` — всё же показывать ошибки. Типичная пара — `-sS` |
| `-f`, `--fail` | При коде ответа 400 и выше — не выводить тело, завершиться с кодом 22 |
| `--fail-with-body` | Как `-f`, но тело ответа выводится (curl 7.76+). Удобно: скрипт падает, а текст ошибки виден |

```bash
# Типовой вариант для скриптов: тихо, но с ошибками, падать на 4xx/5xx, с таймаутом
curl -sS --fail-with-body -m 30 https://api.example.com/v1/orders/42 | jq .

# Проверить результат в bash
if ! curl -sSf -m 10 -o /dev/null https://api.example.com/v1/health; then
  echo "API недоступен"
fi
```

Частые коды завершения curl (не путать с HTTP-кодами):

| Код | Значение |
|---|---|
| 6 | Не удалось разрешить имя хоста (DNS) |
| 7 | Не удалось подключиться (порт закрыт, сервис не запущен, фаервол) |
| 22 | HTTP-ошибка 400+ при `-f` / `--fail-with-body` |
| 28 | Таймаут |
| 35 | Ошибка TLS-рукопожатия |
| 52 | Сервер закрыл соединение, ничего не ответив |
| 56 | Ошибка при получении данных (соединение оборвано) |
| 60 | Сертификат сервера не прошёл проверку (нет доверенного CA, не совпадает имя) |

## Версии HTTP, DNS, сжатие {#http-versions}

```bash
# Принудительно HTTP/1.1
curl --http1.1 https://api.example.com/v1/ping

# Попросить HTTP/2 (по TLS договорится через ALPN, если сервер умеет)
curl --http2 https://api.example.com/v1/ping

# HTTP/3 — только если curl собран с поддержкой HTTP/3 (см. curl --version, строка Features)
curl --http3 https://api.example.com/v1/ping

# Отправить запрос на конкретный IP, сохранив имя хоста (SNI, Host, проверку сертификата)
# Полезно: проверить конкретный узел за балансировщиком или новый сервер до переключения DNS
curl --resolve api.example.com:443:10.0.12.34 https://api.example.com/v1/ping

# Запросить сжатый ответ и автоматически распаковать
curl --compressed https://api.example.com/v1/orders
```

## curl + jq {#jq}

```bash
# Красиво отформатировать ответ
curl -sS https://api.example.com/v1/orders/42 | jq .

# Вытащить одно поле без кавычек
curl -sS https://api.example.com/v1/orders/42 | jq -r '.status'

# Идентификаторы всех заказов в статусе new
curl -sS "https://api.example.com/v1/orders?limit=100" \
  | jq -r '.items[] | select(.status == "new") | .id'

# Пересобрать объект из нужных полей
curl -sS https://api.example.com/v1/orders/42 | jq '{id, status, total: .amount.value}'

# Количество элементов в ответе
curl -sS "https://api.example.com/v1/orders?limit=100" | jq '.items | length'

# Сформировать тело запроса из переменных (jq сам экранирует кавычки и спецсимволы)
jq -n --arg name "$NAME" --argjson qty 2 '{name: $name, quantity: $qty}' \
  | curl -sS --json @- https://api.example.com/v1/items

# Создать ресурс и сразу использовать его ID
ORDER_ID=$(curl -sS --json @order.json https://api.example.com/v1/orders | jq -r '.id')
curl -sS "https://api.example.com/v1/orders/$ORDER_ID" | jq .
```

## Особенности Windows {#windows}

### curl или curl.exe {#windows-curl-exe}

В Windows 10 (1803+) и Windows 11 настоящий curl встроен в систему как `C:\Windows\System32\curl.exe`. Но:

- в **Windows PowerShell 5.1** (`powershell.exe`) слово `curl` — это алиас командлета `Invoke-WebRequest`, у которого совсем другие параметры. Команда `curl -H "..."` из документации выдаст непонятную ошибку;
- в **PowerShell 7+** (`pwsh`) этого алиаса нет, но для надёжности всё равно пишите явно `curl.exe`;
- в **cmd** `curl` — это curl.exe.

```powershell
# Так — правильно в любом PowerShell
curl.exe -i https://api.example.com/v1/ping
```

### Экранирование кавычек в JSON {#windows-quotes}

Одинарные кавычки, привычные по bash, в cmd не работают вообще, а в PowerShell работают с оговорками.

::: code-group

```bash [bash / Git Bash / WSL]
curl https://api.example.com/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"c-1001","comment":"срочно"}'
```

```bat [cmd]
curl https://api.example.com/v1/orders ^
  -H "Content-Type: application/json" ^
  -d "{\"customerId\":\"c-1001\",\"comment\":\"срочно\"}"
```

```powershell [PowerShell 5.1]
# Внутренние кавычки нужно экранировать обратным слешем — для curl.exe, а не для PowerShell
curl.exe https://api.example.com/v1/orders `
  -H "Content-Type: application/json" `
  -d '{\"customerId\":\"c-1001\",\"comment\":\"srochno\"}'
```

```powershell [PowerShell 7.3+]
# Начиная с 7.3 PowerShell сам корректно передаёт кавычки во внешние программы
curl.exe https://api.example.com/v1/orders `
  -H "Content-Type: application/json" `
  -d '{"customerId":"c-1001","comment":"srochno"}'
```

:::

::: tip Самый надёжный способ в Windows — тело из файла
Положите JSON в файл (в кодировке UTF-8) и передайте его через `--data-binary`. Никакого экранирования, и кириллица не испортится. В PowerShell аргумент с `@` берите в кавычки — иначе PowerShell воспримет `@` как свой оператор.

```powershell
curl.exe https://api.example.com/v1/orders `
  -H "Content-Type: application/json" `
  --data-binary "@order.json"
```
:::

### Перенос длинной команды на несколько строк {#windows-line-continuation}

| Оболочка | Символ переноса | Пример окончания строки |
|---|---|---|
| bash, zsh, Git Bash, WSL | `\` | `-H "Accept: application/json" \` |
| cmd | `^` | `-H "Accept: application/json" ^` |
| PowerShell | `` ` `` (обратный апостроф) | ``-H "Accept: application/json" ` `` |

Символ переноса должен быть **последним** в строке — пробел после него ломает команду. Скопированная из документации команда с `\` в cmd и PowerShell не сработает: замените переносы или соберите команду в одну строку.

### Другие мелочи {#windows-misc}

- Вместо `/dev/null` (выбросить тело ответа) и в cmd, и в PowerShell пишите `-o NUL`.
- В `.bat`-файлах знак процента в `-w "%{http_code}"` нужно удваивать: `-w "%%{http_code}"`. В интерактивной консоли cmd — не нужно.
- Кириллица в аргументах командной строки может прийти на сервер в неверной кодировке (зависит от кодовой страницы консоли). Передавайте такие данные через файл в UTF-8.
- В DevTools браузера есть два варианта копирования: «Copy as cURL (bash)» и «Copy as cURL (cmd)» — берите тот, что соответствует вашей оболочке. Для PowerShell есть «Copy as PowerShell» (генерирует `Invoke-WebRequest`).

## Как читать вывод -v {#reading-verbose}

```text
* Host api.example.com:443 was resolved.
* IPv4: 203.0.113.10
*   Trying 203.0.113.10:443...
* Connected to api.example.com (203.0.113.10) port 443
* ALPN: curl offers h2,http/1.1
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
* TLSv1.3 (IN), TLS handshake, Server hello (2):
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
* ALPN: server accepted h2
* Server certificate:
*  subject: CN=api.example.com
*  start date: Aug  1 00:00:00 2026 GMT
*  expire date: Oct 30 23:59:59 2026 GMT
*  subjectAltName: host "api.example.com" matched cert's "api.example.com"
*  issuer: C=US; O=Example CA; CN=Example Issuing CA
*  SSL certificate verify ok.
* using HTTP/2
> GET /v1/orders/42 HTTP/2
> Host: api.example.com
> User-Agent: curl/8.9.1
> Accept: */*
> Authorization: Bearer eyJhbGciOi...
>
< HTTP/2 200
< content-type: application/json
< content-length: 87
< x-request-id: 3f2b8c1e-7a4d-4e8b-9c2a-1d5e6f7a8b9c
< cache-control: no-store
<
{"id":42,"status":"new","customerId":"c-1001","amount":{"value":"1500.00","currency":"RUB"}}
* Connection #0 to host api.example.com left intact
```

| Префикс строки | Что означает |
|---|---|
| `*` | Служебная информация curl: DNS, соединение, TLS, выбор версии HTTP |
| `>` | Заголовки запроса — то, что **ушло** на сервер |
| `<` | Заголовки ответа — то, что **пришло** от сервера |
| `{` / `}` | Отметки о принятых / отправленных данных (появляются, например, когда тело перенаправлено в файл) |
| без префикса | Тело ответа |

Что искать в выводе при диагностике:

- **Где оборвалось.** Нет `Connected to` — проблема с DNS, сетью или фаерволом. Есть `Connected`, но обрыв на `TLS handshake` — проблема с TLS (версия протокола, сертификат, mTLS). Есть заголовки ответа — сеть и TLS в порядке, смотрите на HTTP-уровень.
- **Сертификат.** `subject`, `subjectAltName` (совпадает ли имя), `expire date` (не истёк ли), `issuer` (кто выдал — нужен ли свой `--cacert`).
- **Что реально отправили.** Строки с `>`: есть ли `Content-Type`, правильный ли `Authorization`, нужный ли путь и версия API.
- **Версия HTTP.** `ALPN: server accepted h2` и `using HTTP/2` — договорились на HTTP/2.
- **Ответ.** Статус, `content-type`, заголовки трассировки (`x-request-id` — его стоит сообщить поставщику при разборе инцидента), `retry-after`, `www-authenticate` при [401](/http/status-codes#401).

## Самые частые флаги {#cheatsheet}

| Флаг | Назначение |
|---|---|
| `-X METHOD` | HTTP-метод |
| `-H "Name: value"` | Добавить заголовок |
| `-d`, `--data` | Тело запроса (POST, form-urlencoded по умолчанию) |
| `--data-binary @file` | Тело из файла байт в байт |
| `--data-raw` | Тело как есть, без обработки `@` |
| `--data-urlencode` | Тело (или query с `-G`) с URL-кодированием |
| `--json` | JSON-тело с нужными заголовками (7.82+) |
| `-F` | Поле multipart/form-data, `@` — файл |
| `-G` | Перенести данные `-d` в строку запроса, метод GET |
| `-u user:pass` | Basic-аутентификация |
| `--oauth2-bearer` | Bearer-токен |
| `-b`, `-c` | Отправить / сохранить cookies |
| `-L` | Следовать редиректам |
| `-i` | Показать заголовки ответа |
| `-I` | Запрос HEAD |
| `-v` | Подробный лог |
| `--trace-ascii file` | Полный дамп обмена |
| `-o file`, `-O` | Сохранить тело в файл |
| `-D file` | Сохранить заголовки ответа |
| `-w format` | Вывести метрики после запроса |
| `-s`, `-S` | Тихий режим / показывать ошибки |
| `-f`, `--fail-with-body` | Ненулевой код завершения при HTTP 400+ |
| `--connect-timeout` | Таймаут соединения |
| `-m`, `--max-time` | Таймаут всего запроса |
| `--retry N` | Повторы при временных ошибках |
| `--cacert` | Доверенный CA |
| `--cert`, `--key` | Клиентский сертификат для mTLS |
| `-k` | Не проверять сертификат (только отладка!) |
| `-x` | Прокси |
| `--resolve host:port:ip` | Подменить DNS для запроса |
| `--compressed` | Запросить и распаковать сжатый ответ |
| `--http1.1`, `--http2`, `--http3` | Версия HTTP |

## Ссылки {#links}

- Официальная документация: curl.se/docs — в том числе «Everything curl» (бесплатная книга).
- `man curl` и `curl --help all` — полный список флагов для вашей версии.
- Связанные страницы: [Основы HTTP](/http/basics), [Коды состояния](/http/status-codes), [Обзор инструментов](/tools/).
