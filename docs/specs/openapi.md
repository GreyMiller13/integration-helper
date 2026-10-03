# OpenAPI

OpenAPI Specification (OAS) — стандарт машиночитаемого описания HTTP API в YAML или JSON. По одному файлу генерируют документацию, клиентский и серверный код, моки, тесты, проверяют совместимость версий. Для системного аналитика спецификация OpenAPI — это и есть контракт интеграции: её согласуют обе стороны, и она должна быть точной до каждого поля.

## История {#history}

| Год | Событие |
|---|---|
| 2010–2011 | Tony Tam в компании Wordnik создаёт Swagger — формат описания API и инструменты к нему |
| 2014 | Swagger 2.0 — массовое распространение |
| 2015 | SmartBear приобретает Swagger и передаёт спецификацию в созданную при Linux Foundation OpenAPI Initiative (OAI) |
| 2016 | Спецификация переименована в OpenAPI Specification. Название Swagger остаётся за инструментами SmartBear: Swagger UI, Swagger Editor, Swagger Codegen |
| 2017 | OpenAPI 3.0.0 — крупная переработка структуры |
| 2021 | OpenAPI 3.1.0 — полная совместимость с JSON Schema 2020-12, вебхуки |
| 2025 | OpenAPI 3.2.0 — иерархические теги, метод `QUERY`, потоковые ответы, улучшения OAuth 2.0 |

::: info Swagger или OpenAPI
«Swagger» сегодня — это название инструментов, а не спецификации. Корректно говорить «спецификация OpenAPI 3.1», а «swagger.yaml» — исторический термин для файлов версии 2.0.
:::

## Версии и ключевые отличия {#versions}

| Возможность | Swagger 2.0 | OpenAPI 3.0 | OpenAPI 3.1 | OpenAPI 3.2 |
|---|---|---|---|---|
| Поле версии | `swagger: "2.0"` | `openapi: 3.0.x` | `openapi: 3.1.x` | `openapi: 3.2.0` |
| Адрес сервера | `host`, `basePath`, `schemes` | `servers` с переменными | `servers` | `servers` |
| Тело запроса | Параметр `in: body`, `formData` | `requestBody` с `content` по медиатипам | То же | То же, плюс потоковые форматы через `itemSchema` |
| Модель схем | `definitions`, подмножество JSON Schema draft 4 | `components/schemas`, расширенное подмножество JSON Schema Wright draft 00 | **Полная JSON Schema 2020-12** | JSON Schema 2020-12 |
| null | Только расширение `x-nullable` | `nullable: true` | `type: [string, "null"]`, `nullable` удалён | Как в 3.1 |
| `oneOf`, `anyOf`, `not` | Нет, только `allOf` | Есть, плюс `discriminator` | Есть | Есть |
| Повторное использование | `definitions`, `parameters`, `responses` | `components`: schemas, responses, parameters, examples, requestBodies, headers, securitySchemes, links, callbacks | Плюс `pathItems` | То же |
| Вебхуки | Нет | Только `callbacks` внутри операции | Раздел верхнего уровня `webhooks` | `webhooks` |
| `paths` | Обязателен | Обязателен | Необязателен — документ может содержать только `components` или `webhooks` | Необязателен |
| Безопасность | `basic`, `apiKey`, `oauth2` | `http` (basic, bearer), `apiKey`, `oauth2`, `openIdConnect` | Плюс `mutualTLS` | Плюс OAuth 2.0 Device Authorization flow, `oauth2MetadataUrl`, пометка `deprecated` |
| HTTP-методы | 7 методов | Плюс `trace` | То же | Плюс `query` и `additionalOperations` для прочих методов |
| Теги | Плоский список | Плоский список | Плоский список | Иерархия: `parent`, `kind`, `summary` |
| Примеры | `example` | `example` и `examples` | В схеме — массив `examples` по JSON Schema, `example` устарел | Плюс `dataValue` и `serializedValue` |
| Лицензия | `name`, `url` | `name`, `url` | Плюс `identifier` по SPDX | То же |

### Что важно про 3.1

- Схемы — это **настоящая JSON Schema 2020-12**: можно использовать `const`, `if`/`then`/`else`, `prefixItems`, `unevaluatedProperties`, `$defs`, `dependentRequired`, числовые `exclusiveMinimum`/`exclusiveMaximum`.
- Рядом с `$ref` разрешены другие ключевые слова (в 3.0 они игнорировались).
- Бинарные данные описываются через `contentMediaType` и `contentEncoding`, а не `format: binary`.
- Переход с 3.0 на 3.1 **не полностью обратно совместим**: меняются `nullable`, `exclusiveMinimum`, `example`, описание файлов. Это минорное изменение номера, но не минорное по смыслу.

### Что важно про 3.2

- **Иерархические теги** — навигация по большим API в документации.
- **Метод `QUERY`** — безопасный идемпотентный запрос с телом, для сложных поисковых запросов.
- **Потоковые ответы**: `itemSchema` описывает отдельный элемент потока для `text/event-stream`, `application/jsonl`, `application/json-seq` и других последовательных медиатипов. См. [SSE и Long Polling](/protocols/sse).
- Параметр с `in: querystring` описывает всю строку запроса как единое целое.
- Поле `$self` — идентификатор документа для разрешения относительных ссылок.

::: warning Поддержка инструментами
На момент написания многие генераторы и линтеры полностью поддерживают 3.0, хорошо — 3.1 и частично — 3.2. Перед выбором версии проверьте весь конвейер компании: редактор, линтер, генератор кода, API Gateway, портал документации. Для внешних партнёров с разным стеком 3.0 или 3.1 по-прежнему самый совместимый выбор.
:::

## Структура документа {#structure}

| Раздел | Обязательный | Назначение |
|---|---|---|
| `openapi` | Да | Версия спецификации |
| `info` | Да | Название, версия API, описание, контакты, лицензия |
| `jsonSchemaDialect` | Нет (3.1+) | Диалект JSON Schema по умолчанию |
| `servers` | Нет | Базовые URL сред: продуктив, тест, песочница |
| `paths` | В 3.0 да | Эндпоинты и операции |
| `webhooks` | Нет (3.1+) | Входящие запросы, которые API отправляет подписчикам |
| `components` | Нет | Переиспользуемые объекты |
| `security` | Нет | Требования безопасности по умолчанию для всех операций |
| `tags` | Нет | Группировка операций в документации |
| `externalDocs` | Нет | Ссылка на внешнюю документацию |

Внутри `components`:

| Раздел | Что хранит |
|---|---|
| `schemas` | Модели данных |
| `parameters` | Параметры path, query, header, cookie |
| `requestBodies` | Тела запросов |
| `responses` | Ответы целиком: описание, заголовки, тело |
| `headers` | Заголовки ответов |
| `examples` | Именованные примеры |
| `securitySchemes` | Схемы аутентификации |
| `links`, `callbacks` | Связи между операциями и обратные вызовы |
| `pathItems` | Переиспользуемые описания путей (3.1+) |

## Полный пример: API заказов {#example}

Небольшой, но реалистичный пример на OpenAPI 3.1: список заказов с курсорной пагинацией, получение по ID, создание с `Idempotency-Key`, ошибки в формате `application/problem+json`, OAuth 2.0 Client Credentials.

::: details Открыть orders-api.yaml целиком

```yaml
openapi: 3.1.1
info:
  title: Orders API
  version: 1.2.0
  summary: Управление заказами интернет-магазина
  description: |
    API для партнёров: создание заказов и получение их статусов.
    Все даты — RFC 3339 в UTC. Деньги — строка с десятичной точкой и код валюты ISO 4217.
  contact:
    name: Команда Orders
    email: orders-api@example.com
servers:
  - url: https://api.example.com/v1
    description: Продуктив
  - url: https://sandbox.api.example.com/v1
    description: Песочница
tags:
  - name: Orders
    description: Заказы
security:
  - oauth2: [orders:read]

paths:
  /orders:
    get:
      tags: [Orders]
      operationId: listOrders
      summary: Список заказов
      description: Возвращает заказы партнёра, отсортированные по дате создания по убыванию.
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Cursor'
        - name: status
          in: query
          description: Фильтр по статусу
          schema:
            $ref: '#/components/schemas/OrderStatus'
        - name: createdFrom
          in: query
          description: Заказы, созданные не раньше указанного момента
          schema:
            type: string
            format: date-time
          example: '2026-10-01T00:00:00Z'
      responses:
        '200':
          description: Страница заказов
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderPage'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/TooManyRequests'
    post:
      tags: [Orders]
      operationId: createOrder
      summary: Создать заказ
      security:
        - oauth2: [orders:write]
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
            examples:
              courier:
                summary: Заказ с курьерской доставкой
                value:
                  externalId: 'PARTNER-77812'
                  customer:
                    name: Иван Петров
                    phone: '+79001234567'
                  items:
                    - sku: 'SKU-1001'
                      quantity: 2
                      price: { amount: '1490.00', currency: RUB }
                  comment: Позвонить за час
      responses:
        '201':
          description: Заказ создан
          headers:
            Location:
              description: URI созданного заказа
              schema:
                type: string
                format: uri
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '409':
          description: Запрос с таким Idempotency-Key ещё обрабатывается
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/Problem'
        '422':
          description: |
            Бизнес-ошибка (нет товара, неверный адрес) или
            повтор Idempotency-Key с другим телом запроса
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/Problem'
        '429':
          $ref: '#/components/responses/TooManyRequests'

  /orders/{orderId}:
    get:
      tags: [Orders]
      operationId: getOrder
      summary: Получить заказ
      parameters:
        - $ref: '#/components/parameters/OrderId'
      responses:
        '200':
          description: Заказ
          headers:
            ETag:
              description: Версия ресурса для условных запросов
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'

components:
  securitySchemes:
    oauth2:
      type: oauth2
      description: OAuth 2.0 Client Credentials. Токен — JWT, срок жизни 1 час.
      flows:
        clientCredentials:
          tokenUrl: https://auth.example.com/oauth2/token
          scopes:
            orders:read: Чтение заказов
            orders:write: Создание заказов

  parameters:
    OrderId:
      name: orderId
      in: path
      required: true
      description: Идентификатор заказа
      schema:
        type: string
        format: uuid
    Limit:
      name: limit
      in: query
      description: Размер страницы
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
    Cursor:
      name: cursor
      in: query
      description: Непрозрачный курсор из поля nextCursor предыдущей страницы
      schema:
        type: string
        maxLength: 512
    IdempotencyKey:
      name: Idempotency-Key
      in: header
      required: true
      description: |
        Уникальный ключ операции (UUID). При повторе запроса передаётся тот же ключ.
        Ключ хранится 24 часа.
      schema:
        type: string
        format: uuid

  schemas:
    OrderStatus:
      type: string
      enum: [NEW, CONFIRMED, SHIPPED, DELIVERED, CANCELLED]
      description: |
        NEW — создан, CONFIRMED — подтверждён, SHIPPED — передан в доставку,
        DELIVERED — доставлен, CANCELLED — отменён

    Money:
      type: object
      required: [amount, currency]
      properties:
        amount:
          type: string
          pattern: '^-?\d+(\.\d{1,2})?$'
          description: Сумма с десятичной точкой
          examples: ['1490.00']
        currency:
          type: string
          pattern: '^[A-Z]{3}$'
          description: Код валюты ISO 4217
          examples: [RUB]

    OrderItem:
      type: object
      required: [sku, quantity, price]
      properties:
        sku:
          type: string
          maxLength: 64
        quantity:
          type: integer
          minimum: 1
          maximum: 999
        price:
          $ref: '#/components/schemas/Money'

    Customer:
      type: object
      required: [name, phone]
      properties:
        name:
          type: string
          maxLength: 200
        phone:
          type: string
          pattern: '^\+[1-9]\d{6,14}$'
          description: Телефон в формате E.164
        email:
          type: [string, 'null']
          format: email

    CreateOrderRequest:
      type: object
      required: [externalId, customer, items]
      additionalProperties: false
      properties:
        externalId:
          type: string
          maxLength: 64
          description: Номер заказа в системе партнёра
        customer:
          $ref: '#/components/schemas/Customer'
        items:
          type: array
          minItems: 1
          maxItems: 100
          items:
            $ref: '#/components/schemas/OrderItem'
        comment:
          type: [string, 'null']
          maxLength: 1000

    Order:
      allOf:
        - $ref: '#/components/schemas/CreateOrderRequest'
        - type: object
          required: [id, status, total, createdAt]
          properties:
            id:
              type: string
              format: uuid
              readOnly: true
            status:
              $ref: '#/components/schemas/OrderStatus'
            total:
              $ref: '#/components/schemas/Money'
            createdAt:
              type: string
              format: date-time
              readOnly: true
            updatedAt:
              type: string
              format: date-time
              readOnly: true

    OrderPage:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items:
            $ref: '#/components/schemas/Order'
        nextCursor:
          type: [string, 'null']
          description: Курсор следующей страницы. null — страница последняя

    Problem:
      type: object
      description: Ошибка в формате RFC 9457
      required: [type, title, status]
      properties:
        type:
          type: string
          format: uri-reference
          examples: ['https://api.example.com/problems/out-of-stock']
        title:
          type: string
        status:
          type: integer
          format: int32
        detail:
          type: string
        instance:
          type: string
          format: uri-reference
        traceId:
          type: string
        errors:
          type: array
          description: Ошибки валидации по полям
          items:
            type: object
            required: [field, message]
            properties:
              field:
                type: string
                examples: ['items[0].quantity']
              code:
                type: string
              message:
                type: string

  responses:
    BadRequest:
      description: Некорректный запрос — ошибка валидации
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/Problem'
    Unauthorized:
      description: Нет токена или токен недействителен
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/Problem'
    NotFound:
      description: Ресурс не найден
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/Problem'
    TooManyRequests:
      description: Превышен лимит запросов
      headers:
        Retry-After:
          description: Через сколько секунд повторить
          schema:
            type: integer
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/Problem'
```

:::

Связанные темы: [Пагинация](/design/pagination), [Идемпотентность](/design/idempotency), [Ошибки (RFC 9457)](/design/errors), [OAuth 2.0](/security/oauth2), [Соглашения о данных](/design/data-conventions).

## $ref и переиспользование {#ref}

`$ref` — ссылка на объект в этом же или другом документе по JSON Pointer:

```yaml
# в этом же файле
$ref: '#/components/schemas/Order'

# в другом файле рядом
$ref: './schemas/money.yaml'

# на объект внутри другого файла
$ref: './common.yaml#/components/responses/NotFound'

# по URL — общие схемы компании
$ref: 'https://schemas.example.com/common/v1/problem.yaml'
```

Рекомендации:

- Выносите в `components` всё, что используется больше одного раза: схемы, ошибки, параметры пагинации, заголовки.
- Общие для компании объекты (Problem, Money, пагинация, заголовки трассировки) держите в отдельном репозитории и подключайте по ссылке.
- Для передачи партнёру собирайте один файл без внешних ссылок (bundle), например `redocly bundle`.
- В 3.0 соседние с `$ref` ключи игнорируются. Чтобы добавить описание к ссылке, оборачивают в `allOf`. В 3.1 можно писать `description` рядом с `$ref`.

## Композиция схем: allOf, oneOf, anyOf {#composition}

| Ключ | Смысл | Применение |
|---|---|---|
| `allOf` | Данные соответствуют **всем** схемам | Наследование и расширение: `Order` = `CreateOrderRequest` + служебные поля |
| `oneOf` | Ровно **одной** схеме | Варианты, взаимоисключающие по смыслу: способ оплаты — карта или СБП |
| `anyOf` | **Одной или нескольким** | Редко; гибкие фильтры |
| `not` | **Не** соответствует схеме | Запреты |

### discriminator

Для `oneOf` полезно указать поле-дискриминатор, по которому сразу понятно, какая схема применяется. Это упрощает валидацию, генерацию кода и чтение документации.

```yaml
PaymentMethod:
  oneOf:
    - $ref: '#/components/schemas/CardPayment'
    - $ref: '#/components/schemas/SbpPayment'
  discriminator:
    propertyName: type
    mapping:
      CARD: '#/components/schemas/CardPayment'
      SBP: '#/components/schemas/SbpPayment'

CardPayment:
  type: object
  required: [type, cardToken]
  properties:
    type:
      const: CARD
    cardToken:
      type: string

SbpPayment:
  type: object
  required: [type, phone]
  properties:
    type:
      const: SBP
    phone:
      type: string
```

::: warning oneOf и пересекающиеся схемы
Если объект подходит под две схемы из `oneOf` (например, у обеих нет обязательных полей и разрешены лишние), валидация упадёт: `oneOf` требует ровно одного совпадения. Делайте варианты взаимоисключающими: обязательное поле-дискриминатор с `const` или `enum`.
:::

## null: 3.0 и 3.1 {#nullable}

::: code-group

```yaml [OpenAPI 3.0]
comment:
  type: string
  nullable: true
  maxLength: 1000
```

```yaml [OpenAPI 3.1]
comment:
  type: [string, 'null']
  maxLength: 1000
```

:::

Помните: «необязательное» (может отсутствовать — нет в `required`) и «nullable» (может быть `null`) — разные вещи. В постановке указывайте оба свойства. Подробнее — [Соглашения о данных](/design/data-conventions).

## readOnly и writeOnly {#readonly-writeonly}

- `readOnly: true` — поле только в ответах (ID, дата создания, вычисленная сумма). Клиент не должен его присылать.
- `writeOnly: true` — поле только в запросах (пароль, номер карты при создании токена). Сервер его не возвращает.

Это позволяет использовать одну схему для запроса и ответа. Но поведение генераторов кода и валидаторов различается. Для внешних API надёжнее отдельные схемы `CreateOrderRequest` и `Order`, как в примере выше.

## Форматы {#formats}

| Тип и формат | Значение | Пример |
|---|---|---|
| `string`, `date-time` | RFC 3339 | `2026-10-03T10:15:00Z` |
| `string`, `date` | Дата RFC 3339 | `2026-10-03` |
| `string`, `uuid` | UUID | `3fa85f64-5717-4562-b3fc-2c963f66afa6` |
| `string`, `email` | Email | `user@example.com` |
| `string`, `uri` | Абсолютный URI | `https://example.com/a` |
| `integer`, `int32` | 32-битное целое | `42` |
| `integer`, `int64` | 64-битное целое | `9007199254740993` |
| `number`, `double` | Число с плавающей точкой | `3.14` |
| `string`, `byte` | Base64 (в 3.1 — `contentEncoding: base64`) | `U3dhZ2dlcg==` |

::: warning int64 и JavaScript
В JavaScript целые числа точны только до 2^53 − 1. Идентификаторы `int64` и денежные суммы в копейках больше этого значения теряют точность в браузере. Для ID и денег безопаснее строка.
:::

`format` — это **подсказка**: многие валидаторы по умолчанию его не проверяют. Если формат критичен, дублируйте его `pattern`.

## Примеры {#examples}

- `examples` на уровне медиатипа — именованные примеры запросов и ответов с `summary`. Их показывают Swagger UI и Redoc, их использует Prism для моков.
- `examples` (массив) внутри схемы 3.1 — примеры значений поля.
- Примеры должны **проходить валидацию** по схеме — проверяйте линтером.
- Дайте примеры для всех основных сценариев и ошибок: их читают чаще, чем описания.

## Design-first и code-first {#design-first}

| Подход | Как | Плюсы | Минусы |
|---|---|---|---|
| **Design-first** (API-first) | Сначала спецификация, согласование, затем код по ней | Контракт согласован до разработки, параллельная работа клиента и сервера по мокам, ревью API аналитиком | Нужна дисциплина синхронизации кода со спецификацией |
| **Code-first** | Спецификация генерируется из аннотаций кода (springdoc, Swashbuckle, FastAPI) | Спецификация всегда соответствует коду, быстро | Контракт появляется после кода, протекают детали реализации, сложнее ревью |

Для интеграций между командами и с внешними партнёрами рекомендуется **design-first**: аналитик проектирует контракт, его согласуют, проверяют линтером, по нему генерируют моки. Соответствие реализации спецификации проверяют контрактными тестами. См. [Тестирование API](/tools/testing).

## Инструменты {#tools}

| Задача | Инструменты |
|---|---|
| Редактирование | Swagger Editor, Stoplight Studio, Redocly, плагины для VS Code и IntelliJ |
| Документация | Swagger UI, Redoc, Stoplight Elements, Scalar |
| Линтинг | Spectral, Redocly CLI |
| Генерация кода | openapi-generator, Swagger Codegen, NSwag, oapi-codegen |
| Моки | Prism, Microcks, WireMock |
| Сравнение версий, breaking changes | oasdiff, openapi-diff |
| Тестирование | Postman, Schemathesis (тесты по спецификации), Dredd |

### Spectral — линтинг

Spectral проверяет спецификацию по правилам: встроенным (`spectral:oas`) и правилам компании.

```yaml
# .spectral.yaml
extends: ["spectral:oas"]
rules:
  operation-operationId: error

  paths-kebab-case:
    description: Сегменты пути в kebab-case
    severity: error
    given: "$.paths[*]~"
    then:
      function: pattern
      functionOptions:
        match: "^(/([a-z0-9-]+|\\{[a-zA-Z0-9]+\\}))+$"

  error-responses-problem-json:
    description: Ошибки 4xx и 5xx описаны в application/problem+json
    severity: warn
    given: "$.paths[*][*].responses[?(@property.match(/^[45]/))].content"
    then:
      field: application/problem+json
      function: truthy
```

```bash
spectral lint orders-api.yaml
```

### Генерация, моки, сравнение версий

```bash
# клиент на Java по спецификации
openapi-generator-cli generate -i orders-api.yaml -g java -o ./orders-client

# мок-сервер по примерам из спецификации
prism mock orders-api.yaml

# breaking changes между версиями
oasdiff breaking orders-api-v1.1.yaml orders-api-v1.2.yaml
```

oasdiff находит удаление эндпоинтов и полей ответа, появление новых обязательных параметров, сужение enum в запросе, изменение типов и т. д. Его стоит запускать в CI на каждое изменение спецификации. Что считается ломающим изменением — см. [Версионирование](/design/versioning).

## Расширения {#extensions}

Поля с префиксом `x-` — расширения, которые игнорируются стандартом, но используются инструментами: `x-internal`, `x-ratelimit`, `x-amazon-apigateway-integration`, `x-codegen-*`. Через расширения компании часто добавляют маппинг полей, владельцев, ссылки на требования. Не злоупотребляйте: стандартные инструменты их не понимают.

## Чек-лист качества спецификации {#quality-checklist}

- [ ] Указана версия OpenAPI, поддерживаемая всеми инструментами конвейера.
- [ ] `info` содержит версию API, описание, контакты владельца.
- [ ] Перечислены `servers` для всех сред.
- [ ] У каждой операции есть уникальный `operationId`, `summary`, `tags`.
- [ ] Для каждого параметра указаны тип, формат, обязательность, ограничения и описание.
- [ ] Для строк — `maxLength` и при необходимости `pattern`. Для чисел — `minimum`/`maximum`. Для массивов — `maxItems`.
- [ ] Перечисления описаны через `enum`, смысл каждого значения расписан в `description`.
- [ ] Разграничены «необязательное» и «nullable».
- [ ] Описаны **все** коды ответов, включая ошибки, в едином формате `application/problem+json`.
- [ ] Указаны заголовки ответов: `Location`, `ETag`, `Retry-After`, лимиты.
- [ ] Описаны схемы безопасности и scopes для каждой операции.
- [ ] Для неидемпотентных операций описан `Idempotency-Key`.
- [ ] Для списков описана пагинация и максимальный размер страницы.
- [ ] Есть примеры запросов и ответов, и они проходят валидацию.
- [ ] Повторяющиеся объекты вынесены в `components`.
- [ ] Спецификация проходит Spectral или Redocly lint без ошибок.
- [ ] Изменения проверяются oasdiff на breaking changes.

## На что обратить внимание аналитику {#checklist}

- [ ] Спецификация — источник истины контракта, а не документ «по мотивам» кода.
- [ ] Выбран подход design-first для межкомандных и внешних интеграций.
- [ ] Версия спецификации согласована с партнёром и его инструментами.
- [ ] Внешним партнёрам передаётся собранный файл без внешних `$ref`.
- [ ] Спецификация хранится в Git, изменения проходят ревью и автоматические проверки.
- [ ] Описание полей содержит бизнес-смысл, а не только тип.
- [ ] Для каждого изменения понятно, ломающее оно или нет, и как это отражено в версии API.

## Стандарты и ссылки {#links}

- [OpenAPI Specification — все версии](https://spec.openapis.org/oas/)
- [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html)
- [OpenAPI Specification 3.2.0](https://spec.openapis.org/oas/v3.2.0.html)
- [OpenAPI Initiative — Learn OpenAPI](https://learn.openapis.org/)
- [JSON Schema 2020-12](https://json-schema.org/specification)
- [Upgrading from OpenAPI 3.0 to 3.1](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0)
- [Spectral](https://github.com/stoplightio/spectral)
- [Redocly CLI](https://redocly.com/docs/cli/)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Prism](https://github.com/stoplightio/prism)
- [oasdiff](https://github.com/oasdiff/oasdiff)
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
