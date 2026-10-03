# GraphQL

GraphQL — язык запросов к API и среда их выполнения. Сервер публикует строго типизированную схему, а клиент в каждом запросе сам описывает, какие поля и связанные объекты ему нужны, и получает ровно их — одним запросом. GraphQL особенно удобен, когда у API много разных клиентов (веб, мобильные приложения, партнёры) с разными потребностями в данных.

## Коротко о GraphQL {#overview}

| Характеристика | Значение |
|---|---|
| Создатель | Facebook (разработка с 2012 года, открыт в 2015 году) |
| Стандарт | GraphQL Specification; развивается GraphQL Foundation при Linux Foundation |
| Транспорт | Обычно HTTP (`POST`, для запросов на чтение также `GET`); подписки — WebSocket или SSE |
| Формат | Запрос — на языке GraphQL, ответ — JSON |
| Контракт | Схема на SDL (Schema Definition Language), обязательна и доступна через интроспекцию |
| Эндпоинт | Обычно один: `/graphql` |
| Операции | `query` (чтение), `mutation` (изменение), `subscription` (подписка на события) |

### Как выглядит обмен

```http
POST /graphql HTTP/1.1
Host: api.example.com
Content-Type: application/json
Accept: application/graphql-response+json, application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...

{
  "query": "query GetOrder($id: ID!) { order(id: $id) { id status total { amount currency } customer { name } } }",
  "variables": { "id": "42" },
  "operationName": "GetOrder"
}
```

```http
HTTP/1.1 200 OK
Content-Type: application/graphql-response+json

{
  "data": {
    "order": {
      "id": "42",
      "status": "PAID",
      "total": { "amount": "1500.00", "currency": "RUB" },
      "customer": { "name": "ООО Ромашка" }
    }
  }
}
```

Форма ответа повторяет форму запроса — клиент заранее знает структуру результата.

## Схема и SDL {#schema}

Схема — центральный контракт GraphQL API. Она описывает все типы, поля, аргументы и точки входа (корневые типы `Query`, `Mutation`, `Subscription`).

```graphql
"""Заказ покупателя"""
type Order {
  id: ID!
  number: String!
  status: OrderStatus!
  createdAt: DateTime!
  total: Money!
  customer: Customer!
  items(first: Int = 20, after: String): OrderItemConnection!
  comment: String
  deliveryDate: Date @deprecated(reason: "Используйте поле delivery.date")
  delivery: Delivery
}

enum OrderStatus {
  NEW
  PAID
  SHIPPED
  CANCELLED
}

type Money {
  amount: Decimal!
  currency: String!
}

type Customer {
  id: ID!
  name: String!
  inn: String
  orders(first: Int, after: String, status: OrderStatus): OrderConnection!
}

interface Node {
  id: ID!
}

union SearchResult = Order | Customer | Product

input CreateOrderInput {
  customerId: ID!
  items: [OrderItemInput!]!
  comment: String
}

input OrderItemInput {
  sku: String!
  quantity: Int!
}

scalar DateTime
scalar Date
scalar Decimal

type Query {
  order(id: ID!): Order
  orders(first: Int = 20, after: String, filter: OrderFilter): OrderConnection!
  search(text: String!): [SearchResult!]!
}

type Mutation {
  createOrder(input: CreateOrderInput!): CreateOrderPayload!
  cancelOrder(id: ID!, reason: String): CancelOrderPayload!
}

type Subscription {
  orderStatusChanged(orderId: ID!): Order!
}
```

### Система типов

| Вид типа | Ключевое слово | Назначение | Пример |
|---|---|---|---|
| Скаляр (scalar) | встроенные или `scalar` | Конечное значение. Встроенные: `Int` (32 бита), `Float`, `String`, `Boolean`, `ID`. Пользовательские: `DateTime`, `Decimal`, `UUID` | `amount: Decimal!` |
| Объект (object) | `type` | Набор полей, каждое со своим типом и, возможно, аргументами | `type Order` |
| Интерфейс (interface) | `interface` | Общий набор полей для нескольких типов | `interface Node` |
| Объединение (union) | `union` | Один из нескольких объектных типов без общих полей | `union SearchResult` |
| Перечисление (enum) | `enum` | Фиксированный набор значений | `enum OrderStatus` |
| Входной тип (input) | `input` | Структура для аргументов, особенно в мутациях. Обычные `type` в аргументах использовать нельзя | `input CreateOrderInput` |
| Список (list) | `[T]` | Массив значений типа `T` | `[OrderItem!]!` |
| Не-null (non-null) | `T!` | Значение не может быть `null` | `id: ID!` |

::: warning Комбинации non-null и списков
`[Item]` — список может быть `null`, элементы могут быть `null`. `[Item!]` — список может быть `null`, элементы нет. `[Item]!` — список не `null`, элементы могут быть `null`. `[Item!]!` — ни список, ни элементы не `null`. В постановке указывайте точно — это влияет на обработку ошибок (см. ниже о «всплытии» `null`).
:::

::: info Тип ID
`ID` сериализуется как строка, даже если внутри число. Клиенты не должны рассчитывать на его структуру. Для денежных сумм не используйте `Float` — введите пользовательский скаляр `Decimal` или передавайте сумму строкой. См. [Соглашения о данных](/design/data-conventions).
:::

## Операции {#operations}

### Query — чтение

```graphql
query CustomerWithOrders($customerId: ID!, $first: Int = 10) {
  customer(id: $customerId) {
    id
    name
    orders(first: $first, status: PAID) {
      edges {
        node {
          id
          number
          total { amount currency }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
```

Поля запроса верхнего уровня могут выполняться параллельно.

### Mutation — изменение

```graphql
mutation CreateOrder($input: CreateOrderInput!) {
  createOrder(input: $input) {
    order {
      id
      number
      status
    }
    errors {
      field
      code
      message
    }
  }
}
```

Переменные:

```json
{
  "input": {
    "customerId": "17",
    "items": [ { "sku": "A-100", "quantity": 2 } ],
    "comment": "Позвонить за час"
  }
}
```

Если в одном запросе несколько мутаций, они выполняются **последовательно** в порядке записи (в отличие от полей `query`).

::: warning Мутации не идемпотентны сами по себе
GraphQL не даёт встроенных гарантий идемпотентности. Для мутаций, создающих сущности или платежи, предусмотрите ключ идемпотентности — в аргументе (`clientMutationId`, `idempotencyKey`) или в HTTP-заголовке `Idempotency-Key`. См. [Идемпотентность](/design/idempotency).
:::

### Subscription — подписка

```graphql
subscription OnOrderStatus($orderId: ID!) {
  orderStatusChanged(orderId: $orderId) {
    id
    status
  }
}
```

Подписка — долгоживущая операция: сервер присылает новое значение при каждом событии. Транспорт не определён спецификацией GraphQL; на практике используют WebSocket (протокол библиотеки `graphql-ws`, подпротокол `graphql-transport-ws`) или SSE. Подробнее о транспортах — [WebSocket](/protocols/websocket) и [SSE](/protocols/sse).

```mermaid
sequenceDiagram
    participant C as Клиент
    participant S as GraphQL-сервер
    participant K as Источник событий
    C->>S: WebSocket connection_init
    S-->>C: connection_ack
    C->>S: subscribe orderStatusChanged orderId 42
    K->>S: Заказ 42 оплачен
    S-->>C: next status PAID
    K->>S: Заказ 42 отгружен
    S-->>C: next status SHIPPED
    C->>S: complete
```

## Переменные, фрагменты, алиасы, директивы {#syntax}

**Переменные (variables)** — параметры операции, передаются отдельно от текста запроса в поле `variables`. Никогда не подставляйте значения в текст запроса конкатенацией: это ломает кэширование persisted queries и открывает путь к инъекциям.

**Фрагменты (fragments)** — переиспользуемые наборы полей:

```graphql
fragment OrderShort on Order {
  id
  number
  status
  total { amount currency }
}

query Dashboard {
  recent: orders(first: 5) {
    edges { node { ...OrderShort } }
  }
  order(id: "42") {
    ...OrderShort
    comment
  }
}
```

**Встроенные фрагменты (inline fragments)** — для интерфейсов и объединений:

```graphql
query Search($text: String!) {
  search(text: $text) {
    __typename
    ... on Order { id number }
    ... on Customer { id name }
    ... on Product { sku title }
  }
}
```

**Алиасы (aliases)** — переименование поля в ответе, позволяет запросить одно поле несколько раз с разными аргументами:

```graphql
query {
  paid: orders(filter: { status: PAID }) { totalCount }
  cancelled: orders(filter: { status: CANCELLED }) { totalCount }
}
```

**Директивы (directives)** — модификаторы выполнения и схемы:

| Директива | Где | Назначение |
|---|---|---|
| `@include(if: Boolean)` | Запрос | Включить поле, если условие истинно |
| `@skip(if: Boolean)` | Запрос | Пропустить поле, если условие истинно |
| `@deprecated(reason: String)` | Схема | Пометить поле или значение enum устаревшим |
| `@specifiedBy(url: String)` | Схема | Ссылка на спецификацию пользовательского скаляра |
| `@oneOf` | Схема | Входной тип, в котором должно быть заполнено ровно одно поле (добавлена в спецификацию недавно, поддерживается не везде) |

## Интроспекция {#introspection}

Схему можно запросить у самого сервера через служебные поля `__schema` и `__type`. На этом построены GraphiQL, автодополнение в IDE и генераторы кода.

```graphql
query {
  __type(name: "Order") {
    name
    fields {
      name
      type { name kind ofType { name kind } }
      isDeprecated
      deprecationReason
    }
  }
}
```

Поле `__typename` можно запросить у любого объекта — оно возвращает имя конкретного типа (важно для объединений и кэширования на клиенте).

## Резолверы и выполнение {#resolvers}

Каждое поле схемы обслуживается **резолвером** — функцией, которая возвращает значение поля. Сервер разбирает запрос, валидирует его по схеме и обходит дерево полей, вызывая резолверы.

```mermaid
flowchart LR
    Q[Текст запроса] --> P[Разбор<br/>parse]
    P --> V[Валидация<br/>по схеме]
    V --> E[Выполнение<br/>вызов резолверов]
    E --> R[Ответ JSON<br/>data и errors]
```

Резолвер может брать данные откуда угодно: из базы, из REST-сервиса, из gRPC, из кэша. Поэтому GraphQL часто ставят **фасадом** над набором микросервисов.

### Проблема N+1 и DataLoader {#n-plus-one}

Наивные резолверы порождают лавину запросов. Запрос «20 заказов и клиент каждого» вызывает 1 запрос за заказами и 20 отдельных запросов за клиентами.

```mermaid
sequenceDiagram
    participant G as GraphQL
    participant DB as База данных
    Note over G,DB: Без DataLoader
    G->>DB: SELECT orders LIMIT 20
    G->>DB: SELECT customer WHERE id = 1
    G->>DB: SELECT customer WHERE id = 2
    G->>DB: ... еще 18 запросов
    Note over G,DB: С DataLoader
    G->>DB: SELECT orders LIMIT 20
    G->>DB: SELECT customers WHERE id IN 1..20
```

**DataLoader** — паттерн (и одноимённая библиотека): резолверы не ходят в источник сразу, а регистрируют ключи; в конце такта выполнения загрузчик делает **один пакетный запрос** по всем накопленным ключам и кэширует результат в пределах запроса.

::: tip Требование к смежным API
Если GraphQL-слой стоит над вашими REST-сервисами, у них должны быть пакетные методы получения по списку идентификаторов (`GET /customers?ids=1,2,3` или `POST /customers/batch-get`). Иначе DataLoader не поможет. См. [Пакетные операции](/design/bulk).
:::

## Ошибки {#errors}

Главная особенность, которую нужно учитывать при интеграции: **ошибки GraphQL обычно возвращаются с HTTP `200 OK`**, а признак ошибки находится в массиве `errors` в теле ответа. Ответ может одновременно содержать данные и ошибки (частичный результат).

```json
{
  "data": {
    "order": {
      "id": "42",
      "status": "PAID",
      "customer": null
    }
  },
  "errors": [
    {
      "message": "Сервис клиентов недоступен",
      "locations": [ { "line": 5, "column": 5 } ],
      "path": [ "order", "customer" ],
      "extensions": {
        "code": "SERVICE_UNAVAILABLE",
        "retryable": true
      }
    }
  ]
}
```

| Поле ошибки | Назначение |
|---|---|
| `message` | Человекочитаемое описание (обязательно) |
| `locations` | Позиция в тексте запроса |
| `path` | Путь к полю в ответе, где произошла ошибка |
| `extensions` | Произвольные дополнительные данные: код ошибки, признак повторяемости, идентификатор трассировки. Структура не стандартизирована — описывайте её в контракте |

### Виды ошибок и HTTP-коды

| Ситуация | `data` | HTTP-код (`application/json`) | HTTP-код (`application/graphql-response+json`) |
|---|---|---|---|
| Невалидный JSON, нет поля `query` | Нет | `400` | `400` |
| Синтаксическая ошибка или ошибка валидации запроса | Нет | `200` | `4xx`, обычно `400` |
| Ошибка в резолвере, частичный результат | Есть, часть полей `null` | `200` | `200` |
| Ошибка аутентификации на уровне HTTP | — | `401` | `401` |
| Превышен лимит запросов | — | `429` | `429` |

Медиатип `application/graphql-response+json` и правила кодов ответа определены спецификацией GraphQL over HTTP, которую разрабатывает GraphQL Foundation. Старые серверы отвечают `application/json` и почти всегда `200`.

::: danger Мониторинг «зелёный», а ошибки есть
Если мониторинг, API-шлюз или клиент считают успехом любой `200 OK`, ошибки GraphQL будут незаметны. В требованиях к интеграции явно укажите: проверять наличие `errors` в теле; считать запрос успешным только при отсутствии ошибок в критичных полях; собирать метрики по `extensions.code`.
:::

### «Всплытие» null

Если резолвер поля с типом non-null (`T!`) вернул ошибку, `null` поднимается к ближайшему родительскому полю, допускающему `null`. Чрезмерное использование `!` приводит к тому, что из-за одной ошибки во вложенном поле весь ответ превращается в `"data": null`.

### Бизнес-ошибки как данные

Ошибки валидации и бизнес-правил удобнее моделировать **в схеме**, а не через `errors`: тогда они типизированы и видны в контракте.

```graphql
type CreateOrderPayload {
  order: Order
  errors: [UserError!]!
}

type UserError {
  field: [String!]
  code: UserErrorCode!
  message: String!
}

# Альтернатива — union-результат
union CancelOrderResult = Order | OrderNotFound | OrderAlreadyShipped
```

Массив `errors` верхнего уровня тогда остаётся для технических сбоев. Сравните с подходом REST — [Ошибки (RFC 9457)](/design/errors).

## Пагинация {#pagination}

Спецификация GraphQL не определяет пагинацию, но де-факто стандарт — **Relay Cursor Connections**: курсорная пагинация с типами `Connection`, `Edge`, `PageInfo`.

```graphql
type OrderConnection {
  edges: [OrderEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}

type OrderEdge {
  cursor: String!
  node: Order!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

| Аргумент | Назначение |
|---|---|
| `first` + `after` | Следующие N элементов после курсора (вперёд) |
| `last` + `before` | Предыдущие N элементов перед курсором (назад) |

```graphql
query NextPage {
  orders(first: 50, after: "Y3Vyc29yOjQy") {
    edges { cursor node { id number } }
    pageInfo { hasNextPage endCursor }
  }
}
```

Курсор непрозрачен для клиента — это закодированная позиция (часто base64). Подробнее о видах пагинации и их свойствах — в разделе [Пагинация](/design/pagination).

## Кэширование {#caching}

HTTP-кэширование в GraphQL почти не работает: все запросы идут `POST` на один URL, а ответ зависит от тела. Поэтому кэширование организуют иначе.

| Подход | Как работает | Ограничения |
|---|---|---|
| Нормализованный кэш на клиенте | Apollo Client, Relay, urql хранят объекты по ключу `__typename` + `id` и переиспользуют их между запросами | Только на клиенте; требует `id` у объектов |
| `GET`-запросы | Запрос на чтение передаётся в URL: `GET /graphql?query=...&variables=...` — можно кэшировать в CDN | Длинные URL, ограничения длины; мутации через `GET` запрещены |
| Persisted queries | Запросы регистрируются заранее, клиент передаёт только идентификатор (хеш) | Нужен процесс публикации запросов |
| Automatic Persisted Queries (APQ) | Клиент сначала шлёт только SHA-256 хеш; если сервер его не знает — шлёт полный текст, сервер запоминает | Решение Apollo, не часть спецификации |
| Кэш резолверов на сервере | Кэширование данных полей или ответов источников | Сложная инвалидация |
| Подсказки кэширования в схеме | Директивы вида `@cacheControl(maxAge: 60)` (Apollo) формируют `Cache-Control` для ответа | Нестандартно, зависит от сервера |

```http
GET /graphql?extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22ecf4ed...%22%7D%7D&variables=%7B%22id%22%3A%2242%22%7D HTTP/1.1
Host: api.example.com
```

::: tip Persisted queries и безопасность
Режим «только зарегистрированные запросы» (allowlist, trusted documents) — сильная защита: сервер выполняет лишь заранее одобренные запросы своих клиентов, произвольные тяжёлые запросы невозможны. Подходит для собственных приложений, но не для публичного API.
:::

Общие принципы кэширования — в разделе [Кэширование](/design/caching).

## Безопасность {#security}

Гибкость GraphQL создаёт специфические риски: клиент может составить запрос, который «положит» сервер.

```graphql
# Пример злонамеренно глубокого запроса
query Evil {
  customer(id: "1") {
    orders(first: 100) {
      edges { node {
        customer {
          orders(first: 100) {
            edges { node {
              customer { orders(first: 100) { totalCount } }
            } }
          }
        }
      } }
    }
  }
}
```

| Риск | Мера защиты |
|---|---|
| Слишком глубокие запросы | Ограничение глубины (depth limit), например 7–10 уровней |
| Дорогие запросы | Анализ сложности (query cost analysis): каждому полю назначается стоимость, списки умножают стоимость на `first`; лимит стоимости на запрос и на клиента в единицу времени |
| Огромные списки | Обязательные аргументы пагинации, максимальное значение `first` |
| Перебор через алиасы и батчи | Ограничение числа алиасов и операций в одном запросе (иначе 1000 попыток входа в одном HTTP-запросе обходят rate limit) |
| Раскрытие схемы | Отключение интроспекции в продуктиве для непубличных API; отключение подсказок «Did you mean …» в сообщениях об ошибках |
| Авторизация | Проверка прав на уровне каждого поля и объекта, а не только эндпоинта (риск BOLA — доступ к чужим объектам по `id`) |
| Утечка внутренних ошибок | Маскирование стек-трейсов и текстов исключений в `errors` |
| Медленные запросы | Таймаут на выполнение запроса, ограничение размера тела |

::: warning Rate limiting по числу HTTP-запросов не работает
Один HTTP-запрос GraphQL может стоить как тысяча REST-запросов. Ограничения нужно считать по сложности (cost), а не по количеству вызовов. См. [Rate limiting](/design/rate-limiting) и [OWASP API Top 10](/security/owasp-api).
:::

## Эволюция схемы и версионирование {#versioning}

Сообщество GraphQL рекомендует **не версионировать API**, а эволюционировать схему непрерывно:

- добавлять новые типы и поля можно свободно — старые клиенты их не запрашивают;
- удаляемые поля сначала помечаются `@deprecated(reason: "...")`, затем по метрикам использования (какие клиенты запрашивают поле) удаляются;
- ломающие изменения: удаление или переименование поля, смена типа, добавление обязательного аргумента, удаление значения enum;
- nullability меняется по-разному для ответов и аргументов: в поле ответа `T` → `T!` безопасно, а `T!` → `T` ломает клиентов, не ожидающих `null`; в аргументе, наоборот, `T!` → `T` безопасно, а `T` → `T!` ломает клиентов, не передающих значение;
- проверку совместимости автоматизируют инструментами сравнения схем (GraphQL Inspector, Apollo Rover `subgraph check`).

Общие подходы — в разделе [Версионирование](/design/versioning).

## Federation — распределённая схема {#federation}

В крупных компаниях одну GraphQL-схему поддерживают несколько команд. **Федерация (federation)** позволяет каждому сервису публиковать свою часть схемы (subgraph), а маршрутизатор (router, gateway) собирает их в единую схему (supergraph) и распределяет выполнение запроса.

```mermaid
flowchart LR
    C[Клиенты] --> R[Router<br/>supergraph]
    R --> S1[Subgraph Заказы]
    R --> S2[Subgraph Клиенты]
    R --> S3[Subgraph Каталог]
```

Тип может быть «расширен» в разных подграфах: например, `Order` определён в сервисе заказов, а поле `Customer.orders` добавлено им же к типу из сервиса клиентов. Связь задаётся ключом сущности (директива `@key(fields: "id")` в Apollo Federation).

Реализации: Apollo Federation (Apollo Router), WunderGraph Cosmo, Hive Gateway и др. Альтернатива — объединение схем (schema stitching).

## GraphQL и REST {#vs-rest}

| Критерий | REST | GraphQL |
|---|---|---|
| Эндпоинты | Много, по ресурсам | Обычно один |
| Кто определяет форму ответа | Сервер | Клиент |
| Over-fetching и under-fetching | Типичны | Устранены по замыслу |
| Связанные данные | Несколько запросов или специальные параметры (`include`, `expand`) | Один запрос с вложенными полями |
| Контракт | OpenAPI (опционален) | Схема SDL (обязательна, интроспекция) |
| Типизация | Зависит от OpenAPI | Строгая, встроенная |
| HTTP-кэширование | Полноценное | Почти не работает |
| Коды ошибок | HTTP-коды состояния | `200` + массив `errors` |
| Версионирование | Версии в URL или заголовках | Непрерывная эволюция, `@deprecated` |
| Загрузка файлов | Нативно (`multipart/form-data`, бинарное тело) | Нет в спецификации; расширения или отдельный REST-эндпоинт |
| Real-time | Через вебхуки, SSE, WebSocket | Подписки (`subscription`) |
| Защита от тяжёлых запросов | Проще: операции заранее известны | Нужны лимиты глубины и сложности |
| Мониторинг | По URL и кодам | По имени операции и `errors`, нужны специальные инструменты |
| Порог входа для партнёров | Низкий | Выше |

## Когда применять {#when}

**GraphQL подходит, если:**
- много клиентов (веб, iOS, Android, партнёры) с разными наборами полей на разных экранах;
- данные сильно связаны (граф сущностей), и клиенту нужно получать их вместе;
- нужен единый фасад над множеством микросервисов (BFF, API-агрегатор);
- важна скорость развития фронтенда без доработок бэкенда под каждый экран;
- мобильные клиенты на медленной сети: меньше запросов и меньше лишних байтов.

**GraphQL не подходит или избыточен, если:**
- простой CRUD с одним-двумя потребителями — [REST](/protocols/rest) проще;
- межсервисное взаимодействие с высокой нагрузкой — [gRPC](/protocols/grpc);
- важно HTTP-кэширование и CDN для публичного контента;
- нужна передача файлов или больших бинарных потоков;
- партнёры ожидают привычный REST API, а команда не готова поддерживать защиту от тяжёлых запросов;
- пакетная передача больших объёмов — [Файловый обмен](/protocols/file-exchange).

## Инструменты {#tools}

| Инструмент | Назначение |
|---|---|
| GraphiQL | Интерактивная IDE в браузере: автодополнение по интроспекции, документация схемы |
| Apollo Sandbox / Apollo Studio | IDE, реестр схем, проверки совместимости, метрики использования полей |
| Postman, Insomnia, Altair | Отправка GraphQL-запросов, коллекции, переменные |
| GraphQL Code Generator | Генерация типов и клиентов (TypeScript, Kotlin, Swift и др.) по схеме |
| GraphQL Inspector | Сравнение схем, поиск ломающих изменений |
| GraphQL Voyager | Визуализация схемы как графа — удобно для аналитика |

## На что обратить внимание аналитику {#analyst-checklist}

- Схема SDL — часть постановки: типы, поля, аргументы, nullability (`!`) осознанно выбраны для каждого поля.
- Для каждого поля описан источник данных (какая система или сервис его отдаёт) — это основа для резолверов.
- Описана модель ошибок: что возвращается в `errors` (технические сбои), что — в схеме как данные (бизнес-ошибки); перечень `extensions.code`.
- Клиентам явно сказано проверять `errors` при `200 OK`; описано поведение при частичном результате.
- Для списков используется пагинация (обычно Relay connections) с максимальным размером страницы.
- Определены лимиты: глубина, стоимость запроса, число алиасов, таймаут, размер запроса.
- Решено, включена ли интроспекция в продуктиве и используются ли persisted queries.
- Авторизация описана на уровне полей и объектов, а не только эндпоинта.
- Для мутаций, создающих сущности, предусмотрена идемпотентность.
- Описан транспорт подписок (WebSocket или SSE), аутентификация при установке соединения, поведение при разрыве.
- Определён процесс эволюции схемы: правила `@deprecated`, срок поддержки устаревших полей, автоматическая проверка ломающих изменений.
- Смежные REST-сервисы, на которые опирается GraphQL, поддерживают пакетное получение по списку ID.

## Стандарты и ссылки {#references}

- [GraphQL Specification](https://spec.graphql.org/)
- [GraphQL over HTTP (рабочий проект спецификации)](https://graphql.github.io/graphql-over-http/)
- [Официальная документация GraphQL](https://graphql.org/learn/)
- [Relay — GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm)
- [DataLoader](https://github.com/graphql/dataloader)
- [graphql-ws — протокол подписок поверх WebSocket](https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md)
- [Apollo Federation](https://www.apollographql.com/docs/graphos/schema-design/federated-schemas/federation)
- [OWASP GraphQL Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html)
- [GraphQL Inspector](https://the-guild.dev/graphql/inspector)
