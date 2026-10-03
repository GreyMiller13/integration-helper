# Медиатипы и согласование содержимого

Медиатип (media type, MIME-тип) сообщает получателю, в каком формате тело сообщения: JSON, XML, PDF, форма с файлами. Согласование содержимого (content negotiation) позволяет клиенту и серверу договориться о формате, языке и сжатии ответа. Ошибки здесь — частая причина «необъяснимых» сбоев интеграции: `415`, `406`, искажённая кириллица, сломанные загрузки файлов.

## Что такое медиатип {#media-type}

```text
application/vnd.example.order.v2+json; charset=utf-8
\_________/ \_______________________/ \___________/
    тип              подтип              параметр
                     \____________/\___/
                      дерево vnd.  суффикс
```

| Часть | Смысл | Примеры |
|---|---|---|
| Тип (type) | Общая категория данных | `application`, `text`, `image`, `audio`, `video`, `multipart`, `message`, `font`, `model` |
| Подтип (subtype) | Конкретный формат | `json`, `xml`, `pdf`, `png`, `form-data` |
| Дерево (tree) | Пространство имён подтипа | Стандартное — без префикса (`json`); `vnd.` — производитель (vendor); `prs.` — личное; `x.` и `x-` — нерегистрируемые, устарели (RFC 6838) |
| Суффикс (structured syntax suffix) | Базовый синтаксис формата (RFC 6839) | `+json`, `+xml`, `+zip`, `+cbor` — парсер может разобрать тело как обычный JSON или XML, даже не зная подтипа |
| Параметры | Уточнения через `;` | `charset=utf-8`, `boundary=...`, `version=2`, `profile=...` |

Тип, подтип и имена параметров **нечувствительны к регистру**: `Application/JSON` и `application/json` эквивалентны. Значения параметров могут быть чувствительны (например, `boundary`). Медиатипы регистрируются в IANA по правилам RFC 6838.

## Частые медиатипы для API {#common-types}

| Медиатип | Назначение | Стандарт |
|---|---|---|
| `application/json` | Основной формат REST API. Кодировка — всегда UTF-8 | RFC 8259 |
| `application/problem+json` | Описание ошибки (Problem Details). Есть и вариант `application/problem+xml` | RFC 9457 |
| `application/merge-patch+json` | Тело `PATCH` в формате JSON Merge Patch | RFC 7396 |
| `application/json-patch+json` | Тело `PATCH` в формате JSON Patch (массив операций) | RFC 6902 |
| `application/xml` | XML-документы | RFC 7303 |
| `text/xml` | XML; используется в SOAP 1.1. Для новых интеграций предпочтительнее `application/xml` | RFC 7303 |
| `application/soap+xml` | Сообщения SOAP 1.2 | RFC 3902 |
| `application/x-www-form-urlencoded` | HTML-форма: `key=value&key2=value2`. Используется в OAuth 2.0 для запросов к token endpoint | WHATWG URL Standard |
| `multipart/form-data` | Форма с файлами, загрузка файлов вместе с метаданными | RFC 7578 |
| `multipart/mixed` | Несколько частей разных типов в одном сообщении: пакетные запросы (OData `$batch`), почта | RFC 2046 |
| `application/octet-stream` | Произвольные двоичные данные, тип неизвестен или не важен | RFC 2046 |
| `text/csv` | Табличные данные, выгрузки. Параметр `header=present` сообщает о строке заголовков | RFC 4180 |
| `application/pdf` | Документы PDF | RFC 8118 |
| `application/x-ndjson` | Newline-delimited JSON: по одному JSON-объекту на строку, для потоков и больших выгрузок. Не зарегистрирован в IANA; встречается также `application/jsonl` (JSON Lines) | Спецификации ndjson и JSON Lines |
| `text/event-stream` | Server-Sent Events — поток событий от сервера (см. [SSE](/protocols/sse)) | HTML Living Standard |
| `application/grpc` | Вызовы gRPC поверх HTTP/2; варианты `application/grpc+proto`, `application/grpc+json` (см. [gRPC](/protocols/grpc)) | Спецификация gRPC over HTTP/2 |
| `application/hal+json` | Гипермедиа-формат HAL: ссылки в `_links`, вложенные ресурсы в `_embedded` | Черновик IETF (draft-kelly-json-hal) |
| `application/vnd.api+json` | Формат JSON:API — соглашение о структуре ответа, связях, пагинации | Спецификация JSON:API, зарегистрирован в IANA |
| `application/ld+json` | JSON-LD — связанные данные, семантическая разметка | W3C JSON-LD |
| `application/x-protobuf` | Protocol Buffers вне gRPC. Встречается также `application/protobuf` | Де-факто |
| `application/zip` | ZIP-архивы | IANA |
| `application/yaml` | YAML (например, спецификации OpenAPI) | RFC 9512 |
| `application/cbor` | Concise Binary Object Representation — двоичный аналог JSON | RFC 8949 |
| `application/jwt` | JSON Web Token как тело | RFC 7519 |
| `text/plain` | Простой текст | RFC 2046 |
| `text/html` | HTML-страницы. В ответе API обычно означает, что ответил не сервис, а прокси или WAF | HTML Living Standard |
| `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` | Изображения | IANA |

Подробнее о самих форматах — [Форматы данных](/protocols/data-formats).

::: tip Подстановочные значения
В `Accept` можно использовать `*/*` (что угодно) и `image/*` (любое изображение). В `Content-Type` подстановки недопустимы: тело всегда имеет конкретный тип.
:::

### Vendor-типы и версионирование {#vendor-types}

Дерево `vnd.` позволяет производителю определить собственный формат. Его используют для **версионирования через медиатип** — версия указывается в `Accept`, а URI ресурса не меняется:

```http
GET /orders/42 HTTP/1.1
Host: api.example.com
Accept: application/vnd.example.order.v2+json
```

```http
HTTP/1.1 200 OK
Content-Type: application/vnd.example.order.v2+json
Vary: Accept

{"id":"42","status":"paid","amount":{"value":"2500.00","currency":"RUB"}}
```

Примеры из реальных API: `application/vnd.github+json` (GitHub), вариант с параметром — `application/json; version=2`.

| Плюсы | Минусы |
|---|---|
| URI ресурса стабилен, версия — свойство представления | Сложнее тестировать из браузера и curl |
| Можно версионировать отдельные ресурсы | Кэши должны учитывать `Vary: Accept` |
| Соответствует идее согласования содержимого | Не все инструменты (API Gateway, генераторы кода) хорошо поддерживают |

Сравнение подходов — [Версионирование](/design/versioning).

## Виды согласования {#negotiation-types}

| Вид | Как работает | Пример |
|---|---|---|
| Проактивное (proactive, server-driven) | Клиент сообщает предпочтения в `Accept*`, сервер выбирает | `Accept: application/json` |
| Реактивное (reactive, agent-driven) | Сервер отвечает списком вариантов (`300 Multiple Choices`), клиент выбирает | Почти не используется |
| Через URI | Формат — часть адреса или параметр | `/orders/42.json`, `/orders/42?format=csv` |

Согласование через URI не является механизмом HTTP, но широко распространено: оно проще в отладке и не требует `Vary`. Многие API комбинируют: по умолчанию JSON, выгрузки — через отдельный эндпоинт или параметр.

## Accept и q-веса {#accept}

Клиент перечисляет приемлемые медиатипы; вес `q` от `0` до `1` (по умолчанию `1`) задаёт предпочтение. `q=0` означает «неприемлемо».

```http
GET /v1/reports/sales-2024-q1 HTTP/1.1
Host: api.example.com
Accept: application/json, text/csv;q=0.8, application/xml;q=0.5, */*;q=0.1
```

Как сервер читает этот заголовок:

| Медиатип | q | Приоритет |
|---|---|---|
| `application/json` | 1 (по умолчанию) | 1-й |
| `text/csv` | 0.8 | 2-й |
| `application/xml` | 0.5 | 3-й |
| `*/*` | 0.1 | Что угодно, если ничего из перечисленного нет |

Правила выбора:

- При равных весах более **конкретный** вариант приоритетнее: `text/csv;header=present` важнее `text/csv`, тот — важнее `text/*`, тот — важнее `*/*`.
- Если `Accept` отсутствует, клиент принимает любой тип.
- Если подходящего представления нет, сервер возвращает [406 Not Acceptable](/http/status-codes#406) **или** игнорирует `Accept` и отдаёт формат по умолчанию. RFC 9110 допускает оба варианта — выбор фиксируется в спецификации.
- Сервер сообщает выбранный формат в `Content-Type` ответа и добавляет `Vary: Accept`.

```http
HTTP/1.1 200 OK
Content-Type: application/json
Vary: Accept
```

## Accept-Language {#accept-language}

Предпочитаемые языки по тегам BCP 47 (RFC 5646): `ru`, `ru-RU`, `en-US`, `kk-KZ`.

```http
GET /v1/products/SKU-A-15 HTTP/1.1
Host: api.example.com
Accept-Language: ru-RU, ru;q=0.9, en;q=0.5
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Language: ru-RU
Vary: Accept-Language

{"sku":"SKU-A-15","name":"Кабель USB-C, 1 м","description":"Кабель для зарядки и передачи данных"}
```

Применение в API: локализованные справочники, названия товаров, тексты ошибок (`title`, `detail` в Problem Details). Машиночитаемые коды ошибок и значения enum **не локализуются** — только человекочитаемые тексты.

## Accept-Encoding и сжатие {#accept-encoding}

Клиент сообщает, какие алгоритмы сжатия (content coding) понимает; сервер сжимает тело и указывает алгоритм в `Content-Encoding`.

```http
GET /v1/orders?limit=1000 HTTP/1.1
Host: api.example.com
Accept-Encoding: zstd, br, gzip
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Encoding: br
Vary: Accept-Encoding
```

| Кодирование | Описание | Стандарт |
|---|---|---|
| `gzip` | Самый совместимый, поддерживается везде | RFC 1952 |
| `deflate` | Исторически путаница реализаций, не рекомендуется | RFC 1950, RFC 1951 |
| `br` | Brotli: сжимает лучше gzip, особенно текст | RFC 7932 |
| `zstd` | Zstandard: высокая скорость при хорошем сжатии | RFC 8878, RFC 9659 |
| `identity` | Без сжатия. `identity;q=0` — запрет несжатого ответа | RFC 9110 |

Особенности:

- `Content-Type` описывает тело **до** сжатия: сжатый JSON — это `application/json` с `Content-Encoding: gzip`.
- `Content-Length` — длина **сжатого** тела.
- Сжатие **тела запроса** (`Content-Encoding: gzip` от клиента) сервер поддерживает не всегда. Если не поддерживает — `415 Unsupported Media Type`, желательно с `Accept-Encoding` в ответе. Обязательно согласуйте заранее.
- Сжатие ответа с секретами вместе с данными, управляемыми атакующим, может открыть атаку BREACH. Для межсерверного обмена риск невелик, для браузерных клиентов — учитывайте.
- `Content-Encoding` и `Transfer-Encoding` — разные вещи: первое — свойство представления (сохраняется в кэше), второе — способ передачи по одному соединению в HTTP/1.1.

::: tip
Для выгрузок больших объёмов JSON сжатие уменьшает трафик в 5–10 раз. Проверьте, что сжатие включено на шлюзе или сервере и что клиент отправляет `Accept-Encoding` — многие HTTP-клиенты не делают этого по умолчанию.
:::

## Ошибки согласования: 406 и 415 {#errors}

| | [406 Not Acceptable](/http/status-codes#406) | [415 Unsupported Media Type](/http/status-codes#415) |
|---|---|---|
| О чём | О формате **ответа** | О формате **тела запроса** |
| Какой заголовок виноват | `Accept` (реже `Accept-Language`, `Accept-Encoding`) | `Content-Type` или `Content-Encoding` |
| Пример | Клиент просит `application/xml`, сервер умеет только JSON | Клиент отправил `text/plain` или XML, сервер ждёт JSON |
| Что вернуть | Список доступных форматов в теле | `Accept-Post`, `Accept-Patch` или `Accept-Encoding` с поддерживаемыми вариантами |
| Можно ли избежать | Сервер может отдать формат по умолчанию вместо `406` | Нет: сервер не может разобрать неизвестный формат |

```http
POST /v1/orders HTTP/1.1
Host: api.example.com
Content-Type: application/xml

<order><customerId>c-1001</customerId></order>
```

```http
HTTP/1.1 415 Unsupported Media Type
Accept-Post: application/json
Content-Type: application/problem+json

{"type":"https://api.example.com/problems/unsupported-media-type","title":"Неподдерживаемый формат","status":415,"detail":"Операция принимает только application/json"}
```

::: warning Частые причины 415
- Клиент не указал `Content-Type` — многие библиотеки по умолчанию отправляют `text/plain` или `application/x-www-form-urlencoded`.
- Сервер сравнивает `Content-Type` строкой и не принимает `application/json; charset=utf-8` вместо `application/json`.
- Сервер не принимает `application/merge-patch+json` в `PATCH`, ожидая `application/json`.
:::

## Vary и кэширование {#vary}

`Vary` в ответе перечисляет заголовки запроса, от которых зависит выбор представления. Кэш (браузер, CDN, прокси) хранит отдельную копию для каждой комбинации их значений и отдаёт копию только запросу с теми же значениями.

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Encoding: gzip
Cache-Control: public, max-age=300
Vary: Accept, Accept-Encoding
```

| Ситуация | Что указывать в `Vary` | Что будет без него |
|---|---|---|
| Формат выбирается по `Accept` | `Accept` | Клиент, просивший XML, получит JSON из кэша |
| Сжатие по `Accept-Encoding` | `Accept-Encoding` | Клиент без поддержки gzip получит сжатое тело |
| Язык по `Accept-Language` | `Accept-Language` | Пользователь получит текст на чужом языке |
| CORS с динамическим `Allow-Origin` | `Origin` | Ответ с разрешением для одного сайта уйдёт другому |
| Ответ зависит от пользователя | Не `Vary: Authorization`, а `Cache-Control: private` или `no-store` | Утечка чужих данных через общий кэш |

::: warning Цена Vary
Каждый заголовок в `Vary` умножает число вариантов в кэше и снижает долю попаданий. `Accept-Language` со множеством комбинаций значений почти уничтожает эффективность кэша. `Vary: *` означает «ответ уникален» — фактически запрет кэширования. Некоторые CDN поддерживают `Vary` ограниченно (только `Accept-Encoding`) — проверяйте документацию. Подробно — [Кэширование](/design/caching).
:::

## multipart/form-data {#multipart}

Формат для передачи **нескольких частей** в одном теле: полей формы, файлов, JSON-метаданных. Части разделяются **границей** (boundary) — строкой, которой гарантированно нет в данных. Граница задаётся параметром `Content-Type`, а в теле каждая часть начинается с `--` и границы; тело заканчивается `--`, границей и ещё одним `--`.

Пример: загрузка договора с метаданными.

```http
POST /v1/documents HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
Content-Type: multipart/form-data; boundary=Boundary7f3c9a1e
Content-Length: 245981

--Boundary7f3c9a1e
Content-Disposition: form-data; name="metadata"
Content-Type: application/json

{"type":"contract","number":"Д-2024/15","counterpartyInn":"7701234567","signedAt":"2024-01-15"}
--Boundary7f3c9a1e
Content-Disposition: form-data; name="file"; filename="договор-2024-15.pdf"
Content-Type: application/pdf

%PDF-1.7
...двоичное содержимое файла...
--Boundary7f3c9a1e--
```

```http
HTTP/1.1 201 Created
Location: /v1/documents/doc-3301
Content-Type: application/json

{"id":"doc-3301","type":"contract","fileName":"договор-2024-15.pdf","size":245632,"sha256":"9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"}
```

То же через curl:

::: code-group

```bash [curl]
curl -X POST https://api.example.com/v1/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F 'metadata={"type":"contract","number":"Д-2024/15"};type=application/json' \
  -F 'file=@договор-2024-15.pdf;type=application/pdf'
```

```http [HTTP]
POST /v1/documents HTTP/1.1
Host: api.example.com
Content-Type: multipart/form-data; boundary=Boundary7f3c9a1e
```

:::

Каждая часть содержит:

| Заголовок части | Обязателен | Смысл |
|---|---|---|
| `Content-Disposition: form-data; name="..."` | Да | Имя поля формы |
| `filename="..."` в `Content-Disposition` | Для файлов | Исходное имя файла |
| `Content-Type` | Нет (по умолчанию `text/plain`) | Тип содержимого части |

::: warning Подводные камни multipart
- **Не формируйте границу и заголовок `Content-Type` вручную** — это делает HTTP-клиент. Если указать `Content-Type: multipart/form-data` без `boundary`, сервер не сможет разобрать тело.
- **Имя файла с кириллицей**: RFC 7578 запрещает в `multipart/form-data` параметр `filename*`; имя передаётся в `filename` в UTF-8 или percent-encoding. Реализации ведут себя по-разному — лучше дублировать имя файла отдельным полем метаданных.
- **Лимиты размера**: проверьте лимиты на всех посредниках (nginx по умолчанию — 1 МБ) и опишите максимальный размер файла и запроса.
- **Тип файла**: не доверяйте `Content-Type` и расширению из запроса — проверяйте содержимое на сервере.
- **Порядок частей** может иметь значение для потоковой обработки: метаданные лучше передавать до файла.
:::

### Альтернативы multipart для загрузки файлов {#upload-alternatives}

| Способ | Как | Когда подходит |
|---|---|---|
| Двоичное тело | `PUT /v1/files/{id}` с `Content-Type: application/pdf`, метаданные — в заголовках или отдельным запросом | Один файл, простые метаданные |
| Base64 в JSON | `{"fileName":"a.pdf","content":"JVBERi0xLjcK..."}` | Небольшие файлы (до единиц МБ). Объём растёт примерно на 33%, весь файл в памяти |
| Двухшаговая загрузка | Создать ресурс и получить URL для загрузки (presigned URL в S3-совместимом хранилище), затем загрузить файл напрямую | Большие файлы, разгрузка API-сервиса |
| Загрузка частями | Файл делится на части, каждая загружается отдельно, затем сборка | Очень большие файлы, нестабильная сеть |

См. также [Файловый обмен](/protocols/file-exchange).

## Content-Disposition при скачивании {#content-disposition}

Заголовок ответа указывает, показать содержимое в браузере (`inline`) или сохранить как файл (`attachment`), и предлагает имя файла (RFC 6266).

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Length: 5242880
Content-Disposition: attachment; filename="otchet.pdf"; filename*=UTF-8''%D0%BE%D1%82%D1%87%D1%91%D1%82.pdf
```

| Параметр | Смысл |
|---|---|
| `inline` | Показать в браузере, если возможно (PDF, изображения) |
| `attachment` | Предложить сохранить файл |
| `filename="..."` | Имя файла в ASCII — запасной вариант для старых клиентов |
| `filename*=UTF-8''...` | Имя в UTF-8, закодированное по RFC 8187. Приоритетнее `filename` |

В примере `filename*` содержит имя `отчёт.pdf`, закодированное percent-encoding. Межсерверный клиент обычно игнорирует `Content-Disposition` и сохраняет файл под своим именем, но если имя важно (например, передаётся в СЭД) — опишите, откуда его брать.

::: danger Безопасность имени файла
Имя файла из `Content-Disposition` или multipart нельзя использовать как путь на диске без очистки: значение `../../etc/passwd` приведёт к записи за пределы каталога (path traversal).
:::

## Кодировки символов и charset {#charset}

| Формат | Правило |
|---|---|
| `application/json` | RFC 8259: JSON между системами **обязан** быть в UTF-8. Параметр `charset` для `application/json` не определён и ни на что не влияет, хотя `charset=utf-8` часто добавляют — это безвредно. Метку порядка байтов (BOM) отправлять нельзя |
| `application/xml` | Кодировка указывается в XML-декларации `encoding="..."`; параметр `charset` в `Content-Type`, если есть, приоритетнее. По умолчанию — UTF-8 |
| `text/xml` | Рекомендуется всегда явно указывать `charset` |
| `text/plain`, `text/csv` | Указывайте `charset` явно: `text/csv; charset=utf-8`. Без него получатель может предположить другую кодировку |
| `application/x-www-form-urlencoded` | Значения percent-кодируются из UTF-8 |

```http
Content-Type: text/csv; charset=utf-8; header=present
```

::: warning Кириллица и устаревшие системы
Старые системы и выгрузки для Excel часто используют `windows-1251`. Признаки проблемы с кодировкой: «Ð¡Ð¾Ð»Ð½Ñ†Ðµ» (UTF-8 прочитан как windows-1252) или «РЎРѕР»РЅС†Рµ» (UTF-8 прочитан как windows-1251). Для CSV, который откроют в Excel, иногда добавляют BOM в начало UTF-8 файла — согласуйте это явно, потому что BOM ломает разбор у других потребителей. В спецификации интеграции всегда фиксируйте кодировку для каждого текстового формата.
:::

## На что обратить внимание аналитику {#analyst-checklist}

- Для каждой операции укажите точный `Content-Type` запроса и ответа, включая ошибки (`application/problem+json`).
- Определите, что делает сервер при неподдерживаемом `Accept`: `406` или формат по умолчанию.
- Убедитесь, что сервер принимает `Content-Type` с параметрами (`application/json; charset=utf-8`).
- Зафиксируйте кодировку всех текстовых форматов; для JSON — только UTF-8 без BOM.
- Для `PATCH` укажите поддерживаемые медиатипы патча.
- Для загрузки файлов опишите способ (multipart, двоичное тело, presigned URL), максимальный размер, допустимые типы, правила имени файла и как вычисляется контрольная сумма.
- Для скачивания — `Content-Type`, `Content-Disposition`, поддержку `Range` для больших файлов.
- Включите сжатие ответов (`gzip` или `br`) для больших выгрузок; сжатие запросов — только по согласованию.
- Если формат или язык выбирается по заголовкам, проверьте `Vary` и поведение CDN.
- Если версия API передаётся через vendor-медиатип, опишите все поддерживаемые типы и тип по умолчанию.

## Стандарты и ссылки {#references}

- [RFC 9110, раздел 8 — Representation Data and Metadata](https://www.rfc-editor.org/rfc/rfc9110.html#section-8)
- [RFC 9110, раздел 12 — Content Negotiation](https://www.rfc-editor.org/rfc/rfc9110.html#section-12)
- [RFC 6838 — Media Type Specifications and Registration Procedures](https://www.rfc-editor.org/rfc/rfc6838.html)
- [RFC 6839 — Additional Media Type Structured Syntax Suffixes](https://www.rfc-editor.org/rfc/rfc6839.html)
- [IANA — Media Types](https://www.iana.org/assignments/media-types/media-types.xhtml)
- [RFC 8259 — The JSON Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259.html)
- [RFC 7303 — XML Media Types](https://www.rfc-editor.org/rfc/rfc7303.html)
- [RFC 7578 — Returning Values from Forms: multipart/form-data](https://www.rfc-editor.org/rfc/rfc7578.html)
- [RFC 2046 — MIME Part Two: Media Types](https://www.rfc-editor.org/rfc/rfc2046.html)
- [RFC 6266 — Use of the Content-Disposition Header Field in HTTP](https://www.rfc-editor.org/rfc/rfc6266.html)
- [RFC 8187 — Indicating Character Encoding and Language for HTTP Header Field Parameters](https://www.rfc-editor.org/rfc/rfc8187.html)
- [RFC 4180 — Common Format and MIME Type for CSV Files](https://www.rfc-editor.org/rfc/rfc4180.html)
- [RFC 5646 — Tags for Identifying Languages (BCP 47)](https://www.rfc-editor.org/rfc/rfc5646.html)
- [RFC 7932 — Brotli Compressed Data Format](https://www.rfc-editor.org/rfc/rfc7932.html)
- [RFC 8878 — Zstandard Compression and the application/zstd Media Type](https://www.rfc-editor.org/rfc/rfc8878.html)
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [JSON:API](https://jsonapi.org/)
- [MDN — Content negotiation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation)
