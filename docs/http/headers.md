# Заголовки HTTP

Поля заголовка (header fields) — метаданные запроса и ответа: формат тела, аутентификация, кэширование, условия, трассировка, лимиты. Через заголовки решается большая часть «невидимых» договорённостей интеграции, поэтому их нужно описывать в контракте так же тщательно, как тело. Ниже — правила работы с заголовками и справочные таблицы по группам.

## Общие правила {#rules}

| Правило | Суть |
|---|---|
| Имя регистронезависимо | `Content-Type`, `content-type` и `CONTENT-TYPE` — один заголовок. **Значения** могут быть чувствительны к регистру (токены, `ETag`, base64) |
| HTTP/2 и HTTP/3 — только нижний регистр | Имена передаются строчными буквами (RFC 9113, RFC 9114). Заголовок с заглавными буквами делает сообщение некорректным. Клиентский код не должен зависеть от регистра имён |
| Повторяющиеся заголовки | Заголовок со списочным значением можно передать несколько раз — это эквивалентно одной строке со значениями через запятую, порядок важен: `Accept: a` и `Accept: b` равно `Accept: a, b` |
| Исключение — `Set-Cookie` | Его нельзя объединять через запятую (запятая встречается в датах `Expires`). Каждая cookie — отдельная строка |
| Префикс `X-` устарел | RFC 6648 (2012) рекомендует не использовать `X-` для новых заголовков: когда «экспериментальный» заголовок становится стандартом, переименовать его уже невозможно (`X-Forwarded-For` и `Forwarded`). Существующие `X-` заголовки продолжают работать |
| Перенос строки запрещён | Старый синтаксис obs-fold (продолжение значения на следующей строке) устарел и должен отвергаться или заменяться пробелом |
| Лимиты размера | Стандарт не ограничивает размер, но серверы ограничивают: обычно 8–16 КБ на строку или на все заголовки. При превышении — `431` или `400` |
| Структурированные поля | Новые заголовки описываются через Structured Field Values (RFC 9651): строго типизированные списки, словари, строки, даты. Пример — `RateLimit`, `Deprecation`, `Priority` |
| Кодировка значений | Значения — ASCII. Кириллицу в заголовках передают закодированной (percent-encoding по RFC 8187, base64) |

### Hop-by-hop и end-to-end {#hop-by-hop}

**End-to-end** заголовки предназначены конечному получателю, прокси передают их без изменений. **Hop-by-hop** — относятся к одному соединению, и прокси их удаляет: `Connection`, `Keep-Alive`, `Proxy-Connection`, `TE`, `Transfer-Encoding`, `Upgrade`, а также все заголовки, перечисленные в `Connection`. В HTTP/2 и HTTP/3 заголовки соединения запрещены.

### Трейлеры {#trailers}

Трейлеры (trailer fields) — заголовки, отправляемые **после тела** при потоковой передаче, когда значение вычисляется в процессе (контрольная сумма, итоговый статус). Объявляются заголовком `Trailer`. Активно используются в gRPC: статус вызова передаётся в трейлерах `grpc-status` и `grpc-message`.

## Классификация {#classification}

| Группа | Примеры | Где применяется |
|---|---|---|
| Заголовки запроса | `Host`, `Accept`, `Authorization`, `If-Match`, `Range`, `User-Agent` | Только в запросе |
| Заголовки ответа | `Location`, `WWW-Authenticate`, `Retry-After`, `Allow`, `Server` | Только в ответе |
| Заголовки представления (representation) | `Content-Type`, `Content-Encoding`, `Content-Language`, `ETag`, `Last-Modified` | Описывают тело, есть и в запросе, и в ответе |
| Заголовки управления (control) | `Cache-Control`, `Expect`, `Max-Forwards` | Управляют обработкой |
| Заголовки соединения | `Connection`, `Keep-Alive`, `Upgrade`, `Transfer-Encoding` | Hop-by-hop, только HTTP/1.1 |

В таблицах ниже направление указано как **Зап.** (запрос), **Отв.** (ответ) или **Оба**.

## Тело и представление {#representation}

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `Content-Type` | Оба | Медиатип тела и его параметры (кодировка, граница multipart) | `Content-Type: application/json` |
| `Content-Length` | Оба | Длина тела в байтах (не в символах) | `Content-Length: 348` |
| `Content-Encoding` | Оба | Сжатие тела. Тип в `Content-Type` описывает тело до сжатия | `Content-Encoding: gzip` |
| `Content-Language` | Оба | Язык содержимого для человека | `Content-Language: ru-RU` |
| `Content-Location` | Оба | URI, по которому доступно именно это представление | `Content-Location: /v1/orders/42.json` |
| `Content-Disposition` | Отв. (и части multipart) | Показать или скачать, имя файла (RFC 6266) | `Content-Disposition: attachment; filename="report.pdf"` |
| `Transfer-Encoding` | Оба | Кодирование передачи в HTTP/1.1, обычно `chunked` — тело частями без заранее известной длины. Hop-by-hop, в HTTP/2 запрещён | `Transfer-Encoding: chunked` |
| `Date` | Отв. (обычно) | Дата и время формирования сообщения в формате HTTP-date (всегда GMT) | `Date: Mon, 15 Jan 2024 10:30:00 GMT` |
| `Trailer` | Оба | Какие поля придут в трейлере после тела | `Trailer: Digest` |
| `Content-Digest` | Оба | Хэш тела для проверки целостности (RFC 9530) | `Content-Digest: sha-256=:RK/0qy18MlBSVnWgjwz6lZEWjP/lF5HF9bvEF8FabDg=:` |

::: warning Content-Length и Transfer-Encoding вместе
Отправлять оба заголовка запрещено. Расхождение в их интерпретации между прокси и сервером — основа атак HTTP request smuggling. Если в интеграции встречается такой запрос — это дефект клиента.
:::

Подробно о медиатипах, кодировках и `Content-Disposition` — [Медиатипы и согласование](/http/content-negotiation).

## Согласование содержимого {#negotiation}

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `Accept` | Зап. | Какие медиатипы ответа клиент принимает, с весами `q` | `Accept: application/json, application/xml;q=0.5` |
| `Accept-Encoding` | Зап. | Какие алгоритмы сжатия поддерживает клиент | `Accept-Encoding: gzip, br, zstd` |
| `Accept-Language` | Зап. | Предпочитаемые языки | `Accept-Language: ru-RU, ru;q=0.9, en;q=0.5` |
| `Accept-Charset` | Зап. | Кодировки. **Устарел**, браузеры не отправляют, сейчас везде UTF-8 | `Accept-Charset: utf-8` |
| `Vary` | Отв. | От каких заголовков запроса зависит ответ — влияет на ключ кэша | `Vary: Accept, Accept-Encoding` |
| `Accept-Patch` | Отв. | Форматы, которые принимает `PATCH` (RFC 5789) | `Accept-Patch: application/merge-patch+json` |
| `Accept-Post` | Отв. | Форматы, которые принимает `POST` | `Accept-Post: application/json, multipart/form-data` |
| `Accept-Ranges` | Отв. | Поддерживаются ли диапазоны | `Accept-Ranges: bytes` |

## Аутентификация {#authentication}

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `Authorization` | Зап. | Учётные данные клиента для сервера | `Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...` |
| `WWW-Authenticate` | Отв. | Вызов (challenge): какой схемой аутентифицироваться. Обязателен в `401` | `WWW-Authenticate: Bearer realm="api", error="invalid_token"` |
| `Proxy-Authorization` | Зап. | Учётные данные для прокси | `Proxy-Authorization: Basic dXNlcjpwYXNz` |
| `Proxy-Authenticate` | Отв. | Вызов от прокси. Обязателен в `407` | `Proxy-Authenticate: Basic realm="corp-proxy"` |
| `Authentication-Info` | Отв. | Дополнительная информация после успешной аутентификации (некоторые схемы, например Digest) | `Authentication-Info: nextnonce="a1b2"` |
| `X-API-Key` и аналоги | Зап. | Нестандартная передача API-ключа | `X-API-Key: 9f8e7d6c5b4a` |

Основные схемы `Authorization`:

| Схема | Формат | Стандарт |
|---|---|---|
| `Basic` | `Basic base64(login:password)` | RFC 7617 |
| `Bearer` | `Bearer` и токен доступа (часто JWT) | RFC 6750 |
| `Digest` | Хэш с nonce | RFC 7616 |
| `DPoP` | Токен, привязанный к ключу клиента, плюс заголовок `DPoP` | RFC 9449 |
| `AWS4-HMAC-SHA256` и другие | Подпись запроса | Проприетарные |

Подробнее — [Аутентификация](/security/authentication), [OAuth 2.0](/security/oauth2), [JWT](/security/jwt).

::: danger
`Authorization` и API-ключи нельзя логировать в открытом виде. Убедитесь, что шлюзы и сервисы маскируют их в логах и трассировке.
:::

## Кэширование {#caching}

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `Cache-Control` | Оба | Директивы кэширования (RFC 9111) | `Cache-Control: private, max-age=60` |
| `ETag` | Отв. | Идентификатор версии представления. Сильный: `"v7"`, слабый: `W/"v7"` | `ETag: "33a64df5"` |
| `Last-Modified` | Отв. | Дата последнего изменения | `Last-Modified: Mon, 15 Jan 2024 08:00:00 GMT` |
| `If-None-Match` | Зап. | Вернуть тело, только если `ETag` не совпадает, иначе `304` | `If-None-Match: "33a64df5"` |
| `If-Modified-Since` | Зап. | Вернуть тело, только если изменён после даты, иначе `304` | `If-Modified-Since: Mon, 15 Jan 2024 08:00:00 GMT` |
| `Expires` | Отв. | Дата устаревания. Игнорируется, если есть `max-age` | `Expires: Tue, 16 Jan 2024 10:30:00 GMT` |
| `Age` | Отв. | Сколько секунд ответ провёл в кэше | `Age: 42` |
| `Pragma` | Зап. | Наследие HTTP/1.0, `no-cache`. **Устарел**, используйте `Cache-Control` | `Pragma: no-cache` |
| `Vary` | Отв. | Варианты ответа в кэше по заголовкам запроса | `Vary: Accept-Encoding` |

Основные директивы `Cache-Control`:

| Директива | Где | Смысл |
|---|---|---|
| `max-age=N` | Оба | Ответ свеж N секунд. В запросе: принимаю ответ не старше N |
| `s-maxage=N` | Отв. | То же для общих кэшей (CDN, прокси), приоритетнее `max-age` |
| `no-cache` | Оба | Хранить можно, но перед использованием **обязательно** перепроверить на сервере |
| `no-store` | Оба | Не сохранять нигде. Для персональных и чувствительных данных |
| `private` | Отв. | Только в кэше клиента, общие кэши не хранят |
| `public` | Отв. | Разрешено хранить в общих кэшах, даже если запрос был с `Authorization` |
| `must-revalidate` | Отв. | Устаревший ответ нельзя отдавать без перепроверки |
| `immutable` | Отв. | Ответ не изменится, пока свеж — не перепроверять (RFC 8246) |
| `stale-while-revalidate=N` | Отв. | Можно отдавать устаревший ответ N секунд, обновляя его в фоне (RFC 5861) |
| `stale-if-error=N` | Отв. | Можно отдавать устаревший ответ N секунд при ошибке сервера (RFC 5861) |
| `only-if-cached` | Зап. | Только из кэша, иначе `504` |

::: tip Значение по умолчанию для API
Для ответов API с персональными или быстро меняющимися данными явно указывайте `Cache-Control: no-store` или `private, no-cache`. Без явных директив кэш вправе применить эвристику и сохранить ответ `200`. Подробно — [Кэширование](/design/caching).
:::

## Условные запросы {#conditional}

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `If-Match` | Зап. | Выполнить, только если текущий `ETag` совпадает. Иначе `412`. Основа оптимистичной блокировки | `If-Match: "v3"` |
| `If-None-Match` | Зап. | Для `GET` — условное чтение (`304`). Для `PUT` со значением `*` — создать, только если ресурса нет | `If-None-Match: *` |
| `If-Unmodified-Since` | Зап. | Выполнить, только если не изменялся после даты. Иначе `412` | `If-Unmodified-Since: Mon, 15 Jan 2024 08:00:00 GMT` |
| `If-Modified-Since` | Зап. | Условное чтение по дате | `If-Modified-Since: Mon, 15 Jan 2024 08:00:00 GMT` |
| `If-Range` | Зап. | Отдать диапазон, только если версия не изменилась, иначе — весь ресурс | `If-Range: "f3a9"` |

`If-Match` и `If-None-Match` имеют приоритет над условиями по дате. Для изменяющих операций используйте **сильные** `ETag`: даты имеют точность в одну секунду и не защищают от двух изменений в одну секунду. Подробно — [Конкурентный доступ](/design/concurrency).

## Диапазоны {#ranges}

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `Range` | Зап. | Запрос части ресурса | `Range: bytes=1048576-2097151` |
| `Accept-Ranges` | Отв. | Поддерживаются ли диапазоны: `bytes` или `none` | `Accept-Ranges: bytes` |
| `Content-Range` | Отв. | Какая часть отдана и общая длина. В `416` — только длина | `Content-Range: bytes 1048576-2097151/5242880` |

Варианты `Range`: `bytes=0-499` (первые 500 байт), `bytes=500-` (с 500-го до конца), `bytes=-500` (последние 500 байт), `bytes=0-99, 200-299` (несколько диапазонов — ответ `multipart/byteranges`). См. [206](/http/status-codes#206), [416](/http/status-codes#416).

## Перенаправление и контекст запроса {#context}

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `Host` | Зап. | Хост и порт целевого сервера. Обязателен в HTTP/1.1, в HTTP/2 заменён `:authority` | `Host: api.example.com` |
| `Location` | Отв. | Адрес для перенаправления (3xx) или созданного ресурса (`201`), статуса операции (`202`) | `Location: /v1/orders/9001` |
| `Referer` | Зап. | Адрес страницы, с которой пришёл запрос (историческая опечатка в имени) | `Referer: https://shop.example.com/cart` |
| `Referrer-Policy` | Отв. | Сколько информации передавать в `Referer` | `Referrer-Policy: strict-origin-when-cross-origin` |
| `User-Agent` | Зап. | Программа клиента и её версия | `User-Agent: crm-integration/3.4.1 (+https://crm.example.com)` |
| `Origin` | Зап. | Источник (схема, хост, порт) запроса. Отправляется браузером в кросс-доменных запросах и `POST` | `Origin: https://app.example.org` |
| `Server` | Отв. | Программное обеспечение сервера | `Server: nginx` |
| `From` | Зап. | Адрес электронной почты ответственного за клиента (роботы) | `From: integration-team@example.com` |
| `Expect` | Зап. | Ожидания от сервера, на практике только `100-continue` | `Expect: 100-continue` |
| `Max-Forwards` | Зап. | Ограничение числа пересылок для `TRACE` и `OPTIONS` | `Max-Forwards: 2` |

::: tip User-Agent в интеграциях
Требуйте от системы-потребителя осмысленный `User-Agent` с именем системы и версией, например `billing-service/2.7.0`. Это сильно упрощает разбор инцидентов и поиск устаревших клиентов. Заголовок `Server` с точной версией ПО в продуктиве лучше скрывать — это информация для атакующего.
:::

## CORS {#cors}

Cross-Origin Resource Sharing — механизм браузера, разрешающий скриптам с одного источника обращаться к API на другом. Для межсерверных интеграций не нужен. Подробно — [CORS](/security/cors).

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `Origin` | Зап. | Источник запроса | `Origin: https://app.example.org` |
| `Access-Control-Request-Method` | Зап. (preflight) | Каким методом будет основной запрос | `Access-Control-Request-Method: PATCH` |
| `Access-Control-Request-Headers` | Зап. (preflight) | Какие заголовки будут в основном запросе | `Access-Control-Request-Headers: authorization, content-type` |
| `Access-Control-Allow-Origin` | Отв. | Какому источнику разрешено читать ответ: конкретный источник или `*` | `Access-Control-Allow-Origin: https://app.example.org` |
| `Access-Control-Allow-Credentials` | Отв. | Разрешено ли отправлять cookies и `Authorization`. С `true` нельзя использовать `*` в `Allow-Origin` | `Access-Control-Allow-Credentials: true` |
| `Access-Control-Allow-Methods` | Отв. (preflight) | Разрешённые методы | `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE` |
| `Access-Control-Allow-Headers` | Отв. (preflight) | Разрешённые заголовки запроса | `Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key` |
| `Access-Control-Expose-Headers` | Отв. | Какие заголовки ответа доступны скрипту (по умолчанию — только простые, например `Content-Type`) | `Access-Control-Expose-Headers: Location, ETag, X-Request-ID` |
| `Access-Control-Max-Age` | Отв. (preflight) | Сколько секунд кэшировать результат preflight | `Access-Control-Max-Age: 600` |

::: warning Частая ошибка
Если фронтенд не видит `Location` или `ETag` из ответа API, хотя в сетевой вкладке они есть, — их забыли перечислить в `Access-Control-Expose-Headers`. Если `Access-Control-Allow-Origin` выбирается динамически по `Origin`, ответ должен содержать `Vary: Origin`.
:::

## Безопасность {#security}

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `Strict-Transport-Security` | Отв. | HSTS: браузер обращается к домену только по HTTPS указанное время (RFC 6797) | `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | Отв. | Откуда странице разрешено загружать ресурсы. Для API — запрет встраивания | `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` |
| `X-Content-Type-Options` | Отв. | Запрет «угадывания» типа содержимого браузером | `X-Content-Type-Options: nosniff` |
| `X-Frame-Options` | Отв. | Запрет показа во фрейме (защита от clickjacking). Заменяется `frame-ancestors` в CSP | `X-Frame-Options: DENY` |
| `Set-Cookie` | Отв. | Установить cookie | `Set-Cookie: sid=8f2c; Path=/; Secure; HttpOnly; SameSite=Lax` |
| `Cookie` | Зап. | Cookies, отправляемые клиентом | `Cookie: sid=8f2c; lang=ru` |
| `Permissions-Policy` | Отв. | Какие возможности браузера (камера, геолокация) доступны странице | `Permissions-Policy: geolocation=()` |
| `Cross-Origin-Resource-Policy` | Отв. | Кто может загружать ресурс | `Cross-Origin-Resource-Policy: same-origin` |

Рекомендуемый набор для ответов REST API (по OWASP REST Security Cheat Sheet): `Cache-Control: no-store`, `Content-Security-Policy: frame-ancestors 'none'`, `Content-Type` с правильным типом, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.

### Атрибуты Set-Cookie {#set-cookie}

| Атрибут | Смысл |
|---|---|
| `Expires=дата` | Дата истечения. Без `Expires` и `Max-Age` — сессионная cookie, удаляется при закрытии браузера |
| `Max-Age=N` | Время жизни в секундах, приоритетнее `Expires` |
| `Domain=example.com` | Для каких доменов отправлять (включая поддомены). Без атрибута — только для точного хоста |
| `Path=/` | Для каких путей отправлять |
| `Secure` | Отправлять только по HTTPS |
| `HttpOnly` | Недоступна из JavaScript — защита от кражи через XSS |
| `SameSite=Strict` | Не отправлять при кросс-сайтовых запросах — защита от CSRF |
| `SameSite=Lax` | Отправлять только при переходе по ссылке верхнего уровня (`GET`). Значение по умолчанию в современных браузерах |
| `SameSite=None` | Отправлять всегда. Требует `Secure` |
| `Partitioned` | Хранить отдельно для каждого сайта верхнего уровня (CHIPS) |
| Префикс `__Secure-` | Cookie принимается, только если установлена с `Secure` по HTTPS |
| Префикс `__Host-` | Плюс без `Domain` и с `Path=/` — привязка к точному хосту |

Для сессионных cookies минимальный набор: `Secure; HttpOnly; SameSite=Lax` (или `Strict`). Атрибут `SameSite` описан в черновике RFC 6265bis, но поддерживается всеми современными браузерами.

## Прокси и посредники {#proxy}

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `Forwarded` | Зап. | Стандартная передача исходных данных клиента (RFC 7239) | `Forwarded: for=203.0.113.7;proto=https;host=api.example.com` |
| `X-Forwarded-For` | Зап. | Цепочка IP: клиент, затем прокси | `X-Forwarded-For: 203.0.113.7, 10.0.0.12` |
| `X-Forwarded-Proto` | Зап. | Исходная схема (`http` или `https`) | `X-Forwarded-Proto: https` |
| `X-Forwarded-Host` | Зап. | Исходный `Host` | `X-Forwarded-Host: api.example.com` |
| `X-Real-IP` | Зап. | IP клиента одним значением (nginx) | `X-Real-IP: 203.0.113.7` |
| `Via` | Оба | Список посредников, через которые прошло сообщение | `Via: 1.1 proxy-a, 2 envoy-gw` |

Значения `X-Forwarded-*` можно подделать на стороне клиента — доверяйте только тем, что добавили собственные прокси. См. [Основы HTTP](/http/basics).

## Служебные заголовки API {#api}

| Заголовок | Направление | Назначение | Пример |
|---|---|---|---|
| `Retry-After` | Отв. | Когда повторить: секунды или HTTP-дата. В `429`, `503`, иногда в `3xx` и `202` | `Retry-After: 30` |
| `Allow` | Отв. | Поддерживаемые ресурсом методы. Обязателен в `405` | `Allow: GET, HEAD, PUT, DELETE` |
| `Link` | Отв. | Типизированные ссылки (RFC 8288): пагинация, связанные ресурсы, документация | `Link: <https://api.example.com/v1/orders?page=3>; rel="next"` |
| `Prefer` | Зап. | Предпочтения клиента по обработке (RFC 7240) | `Prefer: return=minimal` |
| `Preference-Applied` | Отв. | Какие предпочтения сервер учёл | `Preference-Applied: return=minimal` |
| `Idempotency-Key` | Зап. | Ключ идемпотентности для `POST` и `PATCH` (черновик IETF) | `Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"` |
| `X-Request-ID` | Оба | Уникальный идентификатор запроса для логов | `X-Request-ID: 0f8e3c1a-7d22-4b0b-8a5e-6c1f9e2a7b44` |
| `X-Correlation-ID` | Оба | Идентификатор бизнес-операции, общий для цепочки вызовов | `X-Correlation-ID: order-9001-checkout` |
| `traceparent` | Зап. | Контекст распределённой трассировки (W3C Trace Context) | `traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01` |
| `tracestate` | Зап. | Данные трассировки, специфичные для поставщика | `tracestate: congo=t61rcWkgMzE` |
| `RateLimit-Policy` | Отв. | Политики лимитов (черновик IETF) | `RateLimit-Policy: "default";q=100;w=60` |
| `RateLimit` | Отв. | Текущее состояние лимита (черновик IETF) | `RateLimit: "default";r=42;t=18` |
| `X-RateLimit-Limit` | Отв. | Размер лимита (де-факто) | `X-RateLimit-Limit: 100` |
| `X-RateLimit-Remaining` | Отв. | Сколько запросов осталось | `X-RateLimit-Remaining: 42` |
| `X-RateLimit-Reset` | Отв. | Когда лимит сбросится: секунды или Unix-время — зависит от API | `X-RateLimit-Reset: 1705314660` |
| `Deprecation` | Отв. | Ресурс или версия устарели или устареют в указанную дату (RFC 9745) | `Deprecation: @1735689599` |
| `Sunset` | Отв. | Когда ресурс перестанет отвечать (RFC 8594) | `Sunset: Wed, 31 Dec 2025 23:59:59 GMT` |
| `API-Version` и аналоги | Оба | Версия API (нестандартные заголовки, у каждого API — свой) | `API-Version: 2024-06-01` |

### Prefer {#prefer}

Позволяет клиенту попросить сервер о необязательном поведении. Сервер вправе проигнорировать предпочтение; учтённые он перечисляет в `Preference-Applied`.

| Предпочтение | Смысл |
|---|---|
| `return=minimal` | Не возвращать тело после изменения (экономия трафика) |
| `return=representation` | Вернуть полное представление ресурса после изменения |
| `respond-async` | Клиент готов к асинхронной обработке с `202 Accepted` |
| `wait=10` | Клиент готов ждать синхронный ответ до 10 секунд |
| `handling=strict` | Отклонять запрос при любых ошибках, включая некритичные |
| `handling=lenient` | Обрабатывать, игнорируя некритичные ошибки |

```http
POST /v1/reports HTTP/1.1
Host: api.example.com
Content-Type: application/json
Prefer: respond-async, wait=5

{"type":"sales","period":"2024-Q1"}
```

```http
HTTP/1.1 202 Accepted
Location: /v1/operations/op-7f3a
Preference-Applied: respond-async
```

См. [Асинхронные операции](/design/async-operations).

### Идентификаторы запроса и трассировка {#tracing}

- `X-Request-ID` — идентификатор **одного** HTTP-запроса. Генерирует клиент или первый шлюз, сервер возвращает его в ответе и пишет в логи.
- `X-Correlation-ID` — идентификатор **бизнес-операции**, сквозной для цепочки вызовов между системами и сообщений в очередях.
- `traceparent` — стандарт W3C Trace Context: `версия-traceId-parentId-флаги`. Поддерживается OpenTelemetry, большинством APM и шлюзов. Для новых интеграций предпочтительнее нестандартных заголовков. Встречаются также устаревшие B3-заголовки Zipkin (`X-B3-TraceId`, `X-B3-SpanId`).

Подробно — [Наблюдаемость](/reliability/observability).

### Лимиты запросов {#rate-limit-headers}

Черновик IETF «RateLimit header fields for HTTP» прошёл несколько редакций. В актуальной — два структурированных заголовка: `RateLimit-Policy` описывает политики (`q` — квота, `w` — окно в секундах), `RateLimit` — текущее состояние (`r` — осталось, `t` — секунд до сброса). В ранних редакциях использовались `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, а большинство публичных API до сих пор используют `X-RateLimit-*`. Значение `X-RateLimit-Reset` у разных API — то секунды до сброса, то Unix-время: обязательно уточняйте. См. [Rate limiting](/design/rate-limiting).

### Устаревание: Deprecation и Sunset {#deprecation}

```http
HTTP/1.1 200 OK
Deprecation: @1735689599
Sunset: Tue, 30 Jun 2026 23:59:59 GMT
Link: <https://developer.example.com/migration/v3>; rel="deprecation"; type="text/html"
Link: <https://api.example.com/v3/orders>; rel="successor-version"
```

- `Deprecation` (RFC 9745) — структурированная дата (Unix-время с префиксом `@`): с какого момента ресурс считается устаревшим. Может указывать на прошлое или будущее.
- `Sunset` (RFC 8594) — HTTP-дата, после которой ресурс перестанет отвечать (затем — `410 Gone` или `404`).
- `Link` с `rel="deprecation"` — ссылка на описание миграции.

См. [Версионирование](/design/versioning).

### Версия API в заголовке {#api-version-headers}

Стандартного заголовка версии нет. Распространённые варианты:

| Вариант | Пример |
|---|---|
| Собственный заголовок | `API-Version: 2`, `X-API-Version: 2024-06-01` |
| Заголовок конкретного поставщика | `Stripe-Version: 2024-06-20`, `X-GitHub-Api-Version: 2022-11-28` |
| Vendor-медиатип в `Accept` | `Accept: application/vnd.example.v2+json` |
| Параметр медиатипа | `Accept: application/json; version=2` |

Выбор между версией в пути, заголовке и медиатипе — в разделе [Версионирование](/design/versioning).

## Какие заголовки описывать в спецификации интеграции {#spec}

Заголовки — часть контракта. В спецификации (OpenAPI — раздел `parameters` с `in: header` и `headers` в ответах) фиксируйте:

| Заголовок | Запрос или ответ | Что указать |
|---|---|---|
| `Authorization` или ключ API | Запрос | Схема, где получить токен, срок жизни. В OpenAPI — через `securitySchemes` |
| `Content-Type` | Оба | Точный медиатип и кодировку для каждой операции |
| `Accept` | Запрос | Поддерживаемые форматы ответа и поведение при неподдерживаемом (`406` или формат по умолчанию) |
| `Idempotency-Key` | Запрос | Для каких операций обязателен, формат (UUID), срок хранения, поведение при повторе с другим телом |
| `If-Match` | Запрос | Обязателен ли для изменений (`428` при отсутствии) |
| `X-Request-ID`, `X-Correlation-ID`, `traceparent` | Оба | Кто генерирует, формат, возвращается ли в ответе |
| `Location` | Ответ | Для `201`, `202`, `3xx` — абсолютный или относительный URI |
| `ETag`, `Last-Modified` | Ответ | Для каких ресурсов, сильный или слабый |
| `Cache-Control` | Ответ | Политика кэширования для каждой операции чтения |
| `Retry-After` | Ответ | В каких ответах, в каком формате (секунды или дата) |
| `RateLimit-*` или `X-RateLimit-*` | Ответ | Названия, единицы, смысл `Reset` |
| `Link` | Ответ | Если используется для пагинации — какие `rel` |
| `Deprecation`, `Sunset` | Ответ | Политика вывода версий из эксплуатации |
| Собственные заголовки | Оба | Имя, обязательность, формат, пример — как для любого параметра |

::: warning Заголовки и посредники
Перед тем как опираться на собственный заголовок, проверьте, что его не удаляет API Gateway, WAF или прокси. Некоторые посредники отбрасывают заголовки с подчёркиванием в имени (nginx по умолчанию игнорирует их: `underscores_in_headers off`) или неизвестные заголовки. Используйте дефис: `Request-Id`, а не `Request_Id`.
:::

## На что обратить внимание аналитику {#analyst-checklist}

- Перечислите все обязательные и необязательные заголовки каждой операции в спецификации, с форматом и примером.
- Не стройте логику на регистре имён заголовков: в HTTP/2 они всегда строчные.
- Для новых собственных заголовков не используйте префикс `X-` и подчёркивания в имени.
- Определите сквозной идентификатор запроса (`X-Request-ID` или `traceparent`) и требуйте его возврата в ответе — особенно в ошибках.
- Зафиксируйте политику кэширования (`Cache-Control`) для каждой операции чтения, а для чувствительных данных — `no-store`.
- Для изменений рассмотрите `ETag` и `If-Match`, для `POST` — `Idempotency-Key`.
- Опишите заголовки лимитов и `Retry-After`, их единицы измерения.
- Если API вызывается из браузера, перечислите в `Access-Control-Expose-Headers` все заголовки ответа, которые нужны фронтенду.
- Убедитесь, что секретные заголовки (`Authorization`, `Cookie`, ключи API) маскируются в логах.
- Проверьте лимиты на размер заголовков у всех посредников, если передаются большие JWT или много cookies.

## Стандарты и ссылки {#references}

- [RFC 9110, раздел 5 — Fields](https://www.rfc-editor.org/rfc/rfc9110.html#section-5)
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [IANA — HTTP Field Name Registry](https://www.iana.org/assignments/http-fields/http-fields.xhtml)
- [RFC 6648 — Deprecating the "X-" Prefix](https://www.rfc-editor.org/rfc/rfc6648.html)
- [RFC 9651 — Structured Field Values for HTTP](https://www.rfc-editor.org/rfc/rfc9651.html)
- [RFC 7240 — Prefer Header for HTTP](https://www.rfc-editor.org/rfc/rfc7240.html)
- [RFC 8288 — Web Linking](https://www.rfc-editor.org/rfc/rfc8288.html)
- [RFC 7239 — Forwarded HTTP Extension](https://www.rfc-editor.org/rfc/rfc7239.html)
- [RFC 6265 — HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265.html)
- [RFC 6797 — HTTP Strict Transport Security](https://www.rfc-editor.org/rfc/rfc6797.html)
- [RFC 9745 — The Deprecation HTTP Response Header Field](https://www.rfc-editor.org/rfc/rfc9745.html)
- [RFC 8594 — The Sunset HTTP Header Field](https://www.rfc-editor.org/rfc/rfc8594.html)
- [RFC 9530 — Digest Fields](https://www.rfc-editor.org/rfc/rfc9530.html)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Черновик IETF — The Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
- [Черновик IETF — RateLimit header fields for HTTP](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/)
- [Fetch Standard — CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)
- [OWASP REST Security Cheat Sheet — Security Headers](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [MDN — HTTP headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
