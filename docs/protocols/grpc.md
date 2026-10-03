# gRPC

gRPC — фреймворк удалённого вызова процедур (RPC), созданный в Google и переданный в Cloud Native Computing Foundation (CNCF). Контракт описывается в файлах `.proto` на языке Protocol Buffers, по нему генерируются клиент и сервер, а данные передаются в компактном бинарном виде поверх HTTP/2. gRPC — основной выбор для быстрых строго типизированных вызовов между микросервисами внутри контура.

## Коротко о gRPC {#overview}

| Характеристика | Значение |
|---|---|
| Происхождение | Google (внутренний фреймворк Stubby), открыт в 2015 году, проект CNCF |
| Транспорт | HTTP/2 (мультиплексирование потоков, бинарные фреймы, сжатие заголовков HPACK) |
| Формат по умолчанию | Protocol Buffers (protobuf) — бинарная сериализация; возможны и другие (JSON, FlatBuffers), но редко |
| Контракт | Файлы `.proto`: сервисы, методы, сообщения. Обязателен |
| Кодогенерация | Официальная поддержка C++, Java, Kotlin, Go, Python, C#/.NET, Node.js, Ruby, PHP, Dart, Objective-C, Swift и др. |
| Типы вызовов | Unary, server streaming, client streaming, bidirectional streaming |
| `Content-Type` | `application/grpc` (или `application/grpc+proto`) |
| Ошибки | Собственные коды статуса gRPC (0–16) в трейлере `grpc-status` |
| Браузер | Напрямую не поддерживается; через gRPC-Web и прокси |

## Как устроен вызов {#how-it-works}

Каждый вызов gRPC — это поток (stream) HTTP/2. Клиент отправляет `POST` на путь `/{пакет}.{Сервис}/{Метод}`, затем сообщения в бинарном фрейминге; сервер отвечает заголовками, сообщениями и **трейлерами** (заголовками после тела), в которых передаётся итоговый статус.

```http
POST /shop.orders.v1.OrderService/GetOrder HTTP/2
content-type: application/grpc
te: trailers
grpc-timeout: 3S
authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
x-request-id: 8d2f6a1e-3c4b-4f7a-9e21-5b6c7d8e9f00

<длина-префиксованное protobuf-сообщение GetOrderRequest>
```

```http
HTTP/2 200
content-type: application/grpc

<длина-префиксованное protobuf-сообщение Order>

grpc-status: 0
grpc-message:
```

Каждое сообщение в теле предваряется 5 байтами: флаг сжатия (1 байт) и длина сообщения (4 байта).

::: warning HTTP 200 не означает успех
HTTP-статус gRPC-ответа почти всегда `200`, даже при ошибке. Результат вызова определяется **только** трейлером `grpc-status`. Это важно для API-шлюзов, балансировщиков и мониторинга: считать ошибки по HTTP-кодам нельзя.
:::

## Protocol Buffers {#protobuf}

Protocol Buffers — язык описания интерфейсов (IDL) и формат сериализации. Актуальная версия синтаксиса для большинства проектов — `proto3`; в новых версиях компилятора появились «редакции» (editions), объединяющие возможности `proto2` и `proto3`.

```protobuf
syntax = "proto3";

package shop.orders.v1;

option java_package = "com.example.shop.orders.v1";
option go_package = "example.com/shop/orders/v1;ordersv1";

import "google/protobuf/timestamp.proto";
import "google/protobuf/field_mask.proto";
import "google/type/money.proto";

// Сервис управления заказами
service OrderService {
  // Unary: получить заказ
  rpc GetOrder(GetOrderRequest) returns (Order);

  // Unary: создать заказ
  rpc CreateOrder(CreateOrderRequest) returns (Order);

  // Server streaming: выгрузить заказы потоком
  rpc ListOrders(ListOrdersRequest) returns (stream Order);

  // Client streaming: загрузить позиции пакетом, получить итог
  rpc UploadItems(stream OrderItem) returns (UploadSummary);

  // Bidirectional streaming: обмен событиями по заказам
  rpc TrackOrders(stream TrackRequest) returns (stream OrderEvent);
}

message GetOrderRequest {
  string order_id = 1;
  google.protobuf.FieldMask read_mask = 2; // какие поля вернуть
}

message CreateOrderRequest {
  string request_id = 1;          // ключ идемпотентности
  string customer_id = 2;
  repeated OrderItem items = 3;
  optional string comment = 4;    // явный признак наличия значения
}

message Order {
  string id = 1;
  string number = 2;
  OrderStatus status = 3;
  google.type.Money total = 4;
  google.protobuf.Timestamp created_at = 5;
  repeated OrderItem items = 6;
  string customer_id = 7;

  oneof delivery {
    CourierDelivery courier = 10;
    PickupPoint pickup = 11;
  }

  reserved 8, 9;
  reserved "discount", "promo_code";
}

message OrderItem {
  string sku = 1;
  int32 quantity = 2;
  google.type.Money price = 3;
}

enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_NEW = 1;
  ORDER_STATUS_PAID = 2;
  ORDER_STATUS_SHIPPED = 3;
  ORDER_STATUS_CANCELLED = 4;
}

message CourierDelivery { string address = 1; }
message PickupPoint { string point_id = 1; }
message ListOrdersRequest { string customer_id = 1; int32 page_size = 2; }
message UploadSummary { int32 accepted = 1; int32 rejected = 2; }
message TrackRequest { string order_id = 1; }
message OrderEvent { string order_id = 1; OrderStatus status = 2; google.protobuf.Timestamp at = 3; }
```

### Ключевые элементы

| Элемент | Назначение |
|---|---|
| `package` | Пространство имён; входит в путь вызова (`/shop.orders.v1.OrderService/GetOrder`). Версию принято включать в имя пакета |
| `message` | Структура данных. Каждое поле имеет тип, имя и **номер** |
| Номер поля | Идентификатор поля в бинарном формате. Имена в бинарный поток не попадают — только номера |
| `repeated` | Список |
| `map` | Словарь: `map<string, int32> stock = 5;` |
| `optional` | В proto3 — явное отслеживание наличия значения (отличает «не передано» от «значение по умолчанию») |
| `oneof` | Ровно одно из полей группы |
| `enum` | Перечисление; первое значение должно быть `0` и по соглашению называется `*_UNSPECIFIED` |
| `reserved` | Запрет повторного использования номеров и имён удалённых полей |
| Well-known types | `google.protobuf.Timestamp`, `Duration`, `FieldMask`, `Struct`, `Empty`, обёртки `StringValue`, `Int64Value` и др. |

### Типы и значения по умолчанию

| Тип protobuf | Значение по умолчанию в proto3 | Комментарий |
|---|---|---|
| `string` | `""` | UTF-8 |
| `bytes` | пустой массив | Бинарные данные |
| `bool` | `false` | |
| `int32`, `int64`, `uint32`, `uint64` | `0` | Для отрицательных чисел эффективнее `sint32`, `sint64` |
| `double`, `float` | `0` | Не используйте для денег: `google.type.Money` или целое в минимальных единицах |
| `enum` | первое значение (`0`) | Поэтому нулевое значение — «не задано» |
| `message` | не задано (`null` в большинстве языков) | Наличие можно проверить |

::: warning Нулевые значения не передаются
В proto3 поле со значением по умолчанию (`0`, `""`, `false`) не сериализуется и для получателя неотличимо от непереданного. Если для бизнеса важно различать «0» и «не указано» (скидка 0 % и скидка не задана), используйте `optional`, обёртки (`google.protobuf.Int32Value`) или отдельный признак. Укажите это в постановке.
:::

### JSON-представление

У protobuf есть каноническое отображение в JSON (ProtoJSON): имена полей переводятся в lowerCamelCase (`created_at` → `createdAt`), `int64` сериализуется строкой, `Timestamp` — строкой RFC 3339, `enum` — именем значения. Оно используется в gRPC-Gateway, транскодировании и для логирования.

## Четыре типа вызовов {#call-types}

| Тип | Сигнатура | Поток сообщений | Примеры применения |
|---|---|---|---|
| Unary | `rpc M(Req) returns (Resp)` | 1 запрос → 1 ответ | Получить, создать, обновить сущность — аналог обычного REST-вызова |
| Server streaming | `rpc M(Req) returns (stream Resp)` | 1 запрос → поток ответов | Выгрузка большого списка, подписка на изменения, прогресс операции |
| Client streaming | `rpc M(stream Req) returns (Resp)` | Поток запросов → 1 ответ | Загрузка файла частями, пакетная отправка телеметрии с итоговым отчётом |
| Bidirectional streaming | `rpc M(stream Req) returns (stream Resp)` | Независимые потоки в обе стороны | Чат, торговые котировки с подписками, синхронизация состояния |

```mermaid
sequenceDiagram
    participant C as Клиент
    participant S as Сервер
    Note over C,S: Unary
    C->>S: GetOrderRequest
    S-->>C: Order и grpc-status 0
    Note over C,S: Server streaming
    C->>S: ListOrdersRequest
    S-->>C: Order 1
    S-->>C: Order 2
    S-->>C: Order N и grpc-status 0
    Note over C,S: Client streaming
    C->>S: OrderItem 1
    C->>S: OrderItem 2
    C->>S: Конец потока
    S-->>C: UploadSummary и grpc-status 0
    Note over C,S: Bidirectional streaming
    C->>S: TrackRequest заказ 42
    S-->>C: OrderEvent 42 PAID
    C->>S: TrackRequest заказ 43
    S-->>C: OrderEvent 43 NEW
    S-->>C: OrderEvent 42 SHIPPED
```

::: tip Стриминг и балансировщики
Долгоживущие потоки держат соединение открытым минутами и часами. Проверьте таймауты простоя (idle timeout) на балансировщиках и прокси, настройте keepalive, и опишите в постановке, что клиент делает при разрыве потока: переподключается и с какой позиции продолжает.
:::

## Коды статуса gRPC {#status-codes}

gRPC использует собственный набор из 17 кодов. Итоговый статус передаётся в трейлере `grpc-status` (число), текст — в `grpc-message`. Соответствие HTTP-кодам ниже — общепринятое (используется в gRPC-Gateway, транскодировании и в Google API); оно нужно, когда gRPC-сервис публикуется наружу как REST.

| Код | Имя | Значение | HTTP | Повторять? |
|---|---|---|---|---|
| 0 | `OK` | Успех | [200](/http/status-codes#200) | — |
| 1 | `CANCELLED` | Вызов отменён (обычно клиентом) | [499](/http/status-codes#499) (нестандартный, Client Closed Request) | Нет |
| 2 | `UNKNOWN` | Неизвестная ошибка, например исключение без статуса | [500](/http/status-codes#500) | Осторожно |
| 3 | `INVALID_ARGUMENT` | Некорректные аргументы независимо от состояния системы (формат, обязательность) | [400](/http/status-codes#400) | Нет |
| 4 | `DEADLINE_EXCEEDED` | Истёк дедлайн до завершения операции; операция могла выполниться | [504](/http/status-codes#504) | Только идемпотентные |
| 5 | `NOT_FOUND` | Сущность не найдена | [404](/http/status-codes#404) | Нет |
| 6 | `ALREADY_EXISTS` | Сущность уже существует | [409](/http/status-codes#409) | Нет |
| 7 | `PERMISSION_DENIED` | Нет прав на операцию (вызывающий аутентифицирован) | [403](/http/status-codes#403) | Нет |
| 8 | `RESOURCE_EXHAUSTED` | Исчерпан ресурс: квота, лимит запросов, место | [429](/http/status-codes#429) | Да, с задержкой |
| 9 | `FAILED_PRECONDITION` | Система не в том состоянии для операции (например, нельзя удалить непустой каталог) | [400](/http/status-codes#400) | Нет, пока состояние не изменится |
| 10 | `ABORTED` | Операция прервана из-за конфликта: конкурентное изменение, сбой транзакции | [409](/http/status-codes#409) | Да, на уровне всей бизнес-операции (чтение — изменение — запись) |
| 11 | `OUT_OF_RANGE` | Выход за допустимый диапазон (чтение за концом файла, страница за пределами) | [400](/http/status-codes#400) | Нет |
| 12 | `UNIMPLEMENTED` | Метод не реализован или не поддерживается | [501](/http/status-codes#501) | Нет |
| 13 | `INTERNAL` | Внутренняя ошибка: нарушены инварианты системы | [500](/http/status-codes#500) | Осторожно |
| 14 | `UNAVAILABLE` | Сервис временно недоступен | [503](/http/status-codes#503) | Да, с экспоненциальной задержкой |
| 15 | `DATA_LOSS` | Невосстановимая потеря или повреждение данных | [500](/http/status-codes#500) | Нет |
| 16 | `UNAUTHENTICATED` | Нет валидных учётных данных | [401](/http/status-codes#401) | Нет (сначала обновить токен) |

::: info Как выбрать между похожими кодами
- `INVALID_ARGUMENT` или `FAILED_PRECONDITION`: если ошибка зависит только от запроса — первый; если от текущего состояния системы — второй.
- `FAILED_PRECONDITION`, `ABORTED` или `UNAVAILABLE`: `UNAVAILABLE` — можно повторить тот же вызов; `ABORTED` — повторить на более высоком уровне (перечитать данные и выполнить заново); `FAILED_PRECONDITION` — не повторять, пока состояние не исправят.
- `NOT_FOUND` или `PERMISSION_DENIED`: если нельзя раскрывать факт существования объекта — `NOT_FOUND` для всех.
:::

Обратное отображение также определено: если gRPC-клиент получил не-gRPC HTTP-ответ (например, от прокси), он преобразует его в статус: `400` → `INTERNAL`, `401` → `UNAUTHENTICATED`, `403` → `PERMISSION_DENIED`, `404` → `UNIMPLEMENTED`, `429`, `502`, `503`, `504` → `UNAVAILABLE`, прочие → `UNKNOWN`.

### Расширенная модель ошибок

Кода и строки часто мало. Google API используют расширенную модель `google.rpc.Status`: код, сообщение и список типизированных деталей. Она передаётся в бинарном трейлере `grpc-status-details-bin`.

| Тип детали | Назначение |
|---|---|
| `ErrorInfo` | Машиночитаемая причина (`reason`), домен, метаданные |
| `BadRequest` | Список нарушений по полям (`field_violations`) |
| `RetryInfo` | Через сколько можно повторить |
| `QuotaFailure` | Какая квота превышена |
| `PreconditionFailure` | Какое предусловие нарушено |
| `ResourceInfo` | Какой ресурс затронут |
| `LocalizedMessage` | Сообщение для пользователя на нужном языке |

## Дедлайны {#deadlines}

Дедлайн (deadline) — момент времени, к которому вызов должен завершиться. Клиент задаёт его при вызове, он передаётся заголовком `grpc-timeout` (например, `500m` — 500 миллисекунд, `3S` — 3 секунды). Если время вышло, вызов завершается со статусом `DEADLINE_EXCEEDED` на обеих сторонах.

- **По умолчанию дедлайна нет** — вызов может висеть бесконечно. Всегда задавайте дедлайн.
- **Распространение (deadline propagation):** сервис A с оставшимися 2 секундами вызывает сервис B — B получает не более оставшегося времени. Цепочка не продолжает работу, результат которой уже никому не нужен.
- Сервер должен проверять отмену и прекращать работу, когда дедлайн истёк.

```mermaid
sequenceDiagram
    participant C as Клиент
    participant A as Сервис A
    participant B as Сервис B
    C->>A: CreateOrder, дедлайн 2 с
    A->>B: ReserveStock, остаток 1.7 с
    Note over B: Долгая обработка
    B--xA: DEADLINE_EXCEEDED
    A--xC: DEADLINE_EXCEEDED
```

Подробнее о выборе таймаутов и политике повторов — в разделе [Таймауты и повторы](/reliability/timeouts-retries).

## Metadata {#metadata}

Metadata — пары «ключ — значение», аналог HTTP-заголовков. Передаются в начале вызова (headers) и в конце (trailers).

| Правило | Пример |
|---|---|
| Ключи — строчные ASCII-символы, цифры, `-`, `_`, `.` | `x-request-id`, `authorization` |
| Бинарные значения — ключ с суффиксом `-bin`, значение кодируется base64 | `trace-context-bin` |
| Префикс `grpc-` зарезервирован для самого gRPC | `grpc-timeout`, `grpc-status` |
| Типичные данные | Токен доступа, идентификатор запроса, контекст трассировки (`traceparent`), локаль, идентификатор клиента |

## Interceptors {#interceptors}

Перехватчики (interceptors) — middleware для gRPC: код, выполняемый вокруг каждого вызова на клиенте или сервере. Отдельно существуют перехватчики для unary-вызовов и для потоков.

Типичные задачи: аутентификация и проверка токена, логирование, метрики, трассировка (OpenTelemetry), повторы на стороне клиента, валидация запросов, преобразование исключений в статусы gRPC, ограничение частоты. См. [Наблюдаемость](/reliability/observability).

## gRPC в браузере и REST-шлюзы {#web-and-gateway}

Браузеры не дают JavaScript управлять фреймами HTTP/2 и трейлерами, поэтому чистый gRPC из браузера недоступен.

| Вариант | Как работает | Ограничения |
|---|---|---|
| gRPC-Web | Модифицированный протокол (`application/grpc-web`, `application/grpc-web-text`), статус передаётся в теле. Нужен прокси-переводчик (Envoy) или поддержка на сервере | Нет client streaming и bidirectional streaming |
| gRPC-Gateway (Go) | Генерирует обратный прокси, принимающий REST/JSON и вызывающий gRPC; маршруты задаются аннотациями `google.api.http` в `.proto` | Отдельный компонент; генерирует и OpenAPI |
| Транскодирование (transcoding) | То же, но встроено: Envoy gRPC-JSON transcoder, ASP.NET Core JSON transcoding, Google Cloud Endpoints | Не все возможности gRPC выразимы в REST |
| Connect | Протокол и библиотеки Buf: один сервер обслуживает gRPC, gRPC-Web и простой HTTP/JSON | Отдельная экосистема |

Аннотация транскодирования:

```protobuf
import "google/api/annotations.proto";

service OrderService {
  rpc GetOrder(GetOrderRequest) returns (Order) {
    option (google.api.http) = {
      get: "/v1/orders/{order_id}"
    };
  }
  rpc CreateOrder(CreateOrderRequest) returns (Order) {
    option (google.api.http) = {
      post: "/v1/orders"
      body: "*"
    };
  }
}
```

После этого тот же метод доступен как обычный REST-вызов `GET /v1/orders/42` с JSON-ответом. Так один контракт обслуживает и внутренних gRPC-клиентов, и внешних REST-партнёров.

## Обратная совместимость protobuf {#schema-evolution}

Бинарный формат protobuf хранит **номера** полей, а не имена. Отсюда правила эволюции схемы.

| Изменение | Совместимо? | Комментарий |
|---|---|---|
| Добавить новое поле с новым номером | Да | Старые клиенты проигнорируют неизвестное поле |
| Удалить поле | Да, если номер и имя внесены в `reserved` | Иначе номер могут переиспользовать — старые клиенты прочитают чужие данные |
| Переименовать поле | Бинарно да, в JSON — нет | ProtoJSON и транскодирование используют имена; сгенерированный код у клиентов тоже меняется |
| Изменить номер поля | **Нет** | Равносильно удалению и добавлению нового поля |
| Изменить тип поля | Как правило, **нет** | Совместимы лишь некоторые пары (`int32`, `uint32`, `int64`, `uint64`, `bool`), но с риском усечения значений |
| Переиспользовать номер удалённого поля | **Нет** | Самая опасная ошибка: тихая порча данных |
| Добавить значение в `enum` | Да, с оговоркой | Старые клиенты получат нераспознанное значение; клиент должен обрабатывать неизвестные значения |
| Удалить значение `enum` | Нет без `reserved` | Аналогично полям |
| Поле → `repeated` и обратно | Нет | Для части типов бинарно возможно, но семантика ломается |
| Перенести поле в `oneof` или из него | Нет | Возможна потеря данных |
| Переименовать сервис, метод или пакет | **Нет** | Меняется путь вызова |
| Добавить метод в сервис | Да | |

```protobuf
message Order {
  string id = 1;
  string number = 2;
  // поле 8 (discount) и поле 9 (promo_code) удалены в v1.4
  reserved 8, 9;
  reserved "discount", "promo_code";
}
```

::: tip Автоматическая проверка
Используйте `buf breaking` (или аналог) в CI: он сравнивает `.proto` с предыдущей версией и блокирует ломающие изменения. Для ломающих изменений вводите новую версию пакета (`shop.orders.v2`) и поддерживайте обе версии на переходный период. См. [Версионирование](/design/versioning).
:::

## Балансировка нагрузки {#load-balancing}

HTTP/2 держит **одно долгое соединение** и мультиплексирует в нём все вызовы. Классический L4-балансировщик (TCP) распределяет соединения, а не запросы: все вызовы клиента уйдут на один экземпляр сервера, новые экземпляры не получат нагрузку.

| Подход | Как работает | Где применяется |
|---|---|---|
| L7-прокси | Прокси понимает HTTP/2 и распределяет отдельные вызовы: Envoy, NGINX, HAProxy, Traefik | Вход в кластер, API-шлюз |
| Service mesh | Сайдкар-прокси (Istio, Linkerd) балансирует на уровне вызовов прозрачно для приложения | Kubernetes |
| Клиентская балансировка | Клиент получает список адресов (DNS, headless service в Kubernetes, xDS) и сам распределяет вызовы (`round_robin`) | Внутренние сервисы без mesh |
| Look-aside | Внешний сервис подсказывает клиенту, куда отправить вызов | Крупные инсталляции |

Дополнительно: health checking по стандартному протоколу `grpc.health.v1.Health`, ограничение времени жизни соединения (`max connection age`) для перераспределения нагрузки.

## Плюсы и минусы {#pros-cons}

| Плюсы | Минусы |
|---|---|
| Высокая производительность: бинарный формат, HTTP/2, мультиплексирование | Нет прямой поддержки в браузере |
| Строгий контракт и кодогенерация на многих языках | Бинарный трафик не прочитать «глазами», сложнее отладка |
| Четыре модели вызовов, включая двунаправленный стриминг | Нужен L7-балансировщик или клиентская балансировка |
| Встроенные дедлайны, отмена, metadata, перехватчики | Нет HTTP-кэширования |
| Единая модель ошибок и статусов | Коды статуса беднее HTTP по семантике для веба, мониторинг нужно настраивать отдельно |
| Хорошая обратная совместимость при соблюдении правил | Внешним партнёрам непривычен, выше порог входа |
| Health checking, reflection, стандарты экосистемы | Некоторые корпоративные прокси и WAF не пропускают HTTP/2 или трейлеры |

## Когда применять {#when}

**gRPC подходит, если:**
- взаимодействие между микросервисами внутри одного контура, где вы контролируете обе стороны;
- важны низкая задержка и высокая пропускная способность;
- нужен стриминг в одну или обе стороны;
- много языков программирования и нужен единый строгий контракт;
- мобильные клиенты с собственными библиотеками (без браузера) и экономией трафика.

**gRPC не подходит, если:**
- API публичный или для широкого круга партнёров — лучше [REST](/protocols/rest) (или gRPC с транскодированием в REST);
- клиент — браузер, и нужен стриминг от клиента;
- важно HTTP-кэширование и CDN;
- инфраструктура (прокси, WAF, шлюзы) не поддерживает HTTP/2 сквозным образом;
- нужна асинхронная гарантированная доставка — используйте [брокер сообщений](/protocols/messaging).

## Инструменты {#tools}

| Инструмент | Назначение |
|---|---|
| `grpcurl` | Аналог curl для gRPC: вызов методов, список сервисов через reflection |
| Postman, Insomnia | Вызов gRPC-методов из GUI, импорт `.proto` или reflection |
| Kreya | Десктопный клиент для gRPC и REST |
| BloomRPC | Был популярным GUI-клиентом, но проект архивирован; используйте альтернативы |
| Evans | Интерактивный консольный клиент |
| `buf` | Линтер, проверка ломающих изменений, генерация кода, реестр схем (Buf Schema Registry) |
| `protoc` | Официальный компилятор `.proto` |
| gRPC Server Reflection | Сервис, позволяющий клиентам узнать схему у сервера (как интроспекция). В продуктиве часто отключают |

```bash
# Список сервисов (нужен включённый reflection)
grpcurl -plaintext localhost:50051 list

# Описание метода
grpcurl -plaintext localhost:50051 describe shop.orders.v1.OrderService.GetOrder

# Вызов с данными в JSON и metadata
grpcurl -H "authorization: Bearer eyJ..." \
  -d '{"order_id": "42"}' \
  api.example.com:443 shop.orders.v1.OrderService/GetOrder

# Вызов с локальным .proto без reflection
grpcurl -import-path ./proto -proto orders.proto \
  -d '{"order_id": "42"}' -plaintext localhost:50051 \
  shop.orders.v1.OrderService/GetOrder
```

## На что обратить внимание аналитику {#analyst-checklist}

- Контракт `.proto` хранится в общем репозитории или реестре схем, имеет владельца и версию; версия входит в имя пакета.
- Для каждого метода указан тип вызова (unary или стриминг) и описана семантика: что означает каждое поле, обязательность (в proto3 её нет на уровне формата — опишите в комментариях и валидации).
- Явно описано, как отличать «не передано» от значения по умолчанию (`optional`, обёртки).
- Для каждого метода перечислены возможные коды статуса gRPC и бизнес-причины (`ErrorInfo.reason`), поведение клиента и признак повторяемости.
- Задан дедлайн для каждого вызова и правила его распространения по цепочке.
- Определено, какие методы идемпотентны; для неидемпотентных — ключ идемпотентности в запросе (`request_id`).
- Для стриминга описаны: поведение при разрыве, переподключение, продолжение с позиции, keepalive, лимиты размера сообщений (по умолчанию 4 МБ на приём во многих реализациях).
- Решён вопрос балансировки (L7-прокси, mesh или клиентская балансировка) и health checks.
- Если сервис нужен внешним потребителям или браузеру — предусмотрено транскодирование в REST или gRPC-Web.
- Описаны metadata: аутентификация, идентификатор запроса, трассировка.
- В CI включена проверка обратной совместимости `.proto`, а удалённые поля помечаются `reserved`.

## Стандарты и ссылки {#references}

- [gRPC — официальная документация](https://grpc.io/docs/)
- [gRPC over HTTP/2 — спецификация протокола](https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md)
- [gRPC Status Codes](https://grpc.io/docs/guides/status-codes/)
- [Отображение HTTP-статусов в коды gRPC](https://github.com/grpc/grpc/blob/master/doc/http-grpc-status-mapping.md)
- [gRPC Deadlines](https://grpc.io/docs/guides/deadlines/)
- [gRPC Error Handling](https://grpc.io/docs/guides/error/)
- [Protocol Buffers — Language Guide (proto3)](https://protobuf.dev/programming-guides/proto3/)
- [Protocol Buffers — Best Practices](https://protobuf.dev/best-practices/dos-donts/)
- [ProtoJSON Format](https://protobuf.dev/programming-guides/json/)
- [google.rpc.Code — соответствие HTTP](https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto)
- [gRPC-Web](https://github.com/grpc/grpc-web)
- [gRPC-Gateway](https://grpc-ecosystem.github.io/grpc-gateway/)
- [RFC 9113 — HTTP/2](https://www.rfc-editor.org/rfc/rfc9113)
- [Google API Design Guide — Errors](https://cloud.google.com/apis/design/errors)
