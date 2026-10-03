# OData

OData (Open Data Protocol) — стандарт OASIS для построения REST-подобных API поверх HTTP с единым языком запросов в URL (`$filter`, `$select`, `$expand`, `$orderby`) и машиночитаемым описанием модели данных (`$metadata`). Клиент, знающий OData, может работать с любым OData-сервисом без отдельной документации на фильтрацию и пагинацию. OData — штатный интерфейс SAP, Microsoft Dynamics 365, Microsoft Graph и платформы 1С:Предприятие.

## Коротко об OData {#overview}

| Характеристика | Значение |
|---|---|
| Автор | Microsoft (2007), затем стандарт OASIS |
| Версии | v2 и v3 — устаревшие, но широко распространены (SAP Gateway, 1С); **v4.0** — стандарт OASIS 2014 года, также ISO/IEC 20802; **v4.01** — 2020 год |
| Транспорт | HTTP |
| Формат | JSON (основной в v4); Atom/XML в v2 и v3 |
| Контракт | CSDL (Common Schema Definition Language) — документ `$metadata` в XML (EDMX) или, начиная с v4.01, в JSON |
| Модель данных | Entity Data Model (EDM): сущности, свойства, ключи, связи (навигационные свойства), операции |
| Заголовки версии | `OData-Version`, `OData-MaxVersion` |

## Структура сервиса {#structure}

| Адрес | Что возвращает |
|---|---|
| `/odata/` (корень) | Сервисный документ (service document): список наборов сущностей, синглтонов и функций |
| `/odata/$metadata` | Полное описание модели: типы, свойства, ключи, связи, операции |
| `/odata/Orders` | Коллекция (entity set) |
| `/odata/Orders(42)` | Сущность по ключу |
| `/odata/Orders(42)/Customer` | Связанная сущность по навигационному свойству |
| `/odata/Orders(42)/Items` | Связанная коллекция |
| `/odata/Orders(42)/Status` | Значение отдельного свойства |
| `/odata/Orders(42)/Status/$value` | «Сырое» значение свойства без JSON-обёртки |
| `/odata/Orders/$count` | Количество элементов коллекции (простое число) |
| `/odata/Customers('ALFKI')` | Строковый ключ — в одинарных кавычках |
| `/odata/OrderItems(OrderId=42,LineNo=1)` | Составной ключ |

### Сервисный документ

```http
GET /odata/ HTTP/1.1
Host: erp.example.com
Accept: application/json
OData-MaxVersion: 4.0
```

```json
{
  "@odata.context": "https://erp.example.com/odata/$metadata",
  "value": [
    { "name": "Orders",    "kind": "EntitySet", "url": "Orders" },
    { "name": "Customers", "kind": "EntitySet", "url": "Customers" },
    { "name": "Products",  "kind": "EntitySet", "url": "Products" },
    { "name": "Me",        "kind": "Singleton", "url": "Me" }
  ]
}
```

### $metadata — описание модели (CSDL)

```xml
<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Shop" xmlns="http://docs.oasis-open.org/odata/ns/edm">

      <EntityType Name="Order">
        <Key>
          <PropertyRef Name="Id"/>
        </Key>
        <Property Name="Id" Type="Edm.Int64" Nullable="false"/>
        <Property Name="Number" Type="Edm.String" MaxLength="20" Nullable="false"/>
        <Property Name="Status" Type="Shop.OrderStatus" Nullable="false"/>
        <Property Name="Total" Type="Edm.Decimal" Precision="18" Scale="2"/>
        <Property Name="CreatedAt" Type="Edm.DateTimeOffset" Nullable="false"/>
        <NavigationProperty Name="Customer" Type="Shop.Customer" Nullable="false"/>
        <NavigationProperty Name="Items" Type="Collection(Shop.OrderItem)" ContainsTarget="true"/>
      </EntityType>

      <EntityType Name="Customer">
        <Key><PropertyRef Name="Id"/></Key>
        <Property Name="Id" Type="Edm.Guid" Nullable="false"/>
        <Property Name="Name" Type="Edm.String"/>
        <Property Name="Inn" Type="Edm.String" MaxLength="12"/>
        <NavigationProperty Name="Orders" Type="Collection(Shop.Order)"/>
      </EntityType>

      <EntityType Name="OrderItem">
        <Key><PropertyRef Name="LineNo"/></Key>
        <Property Name="LineNo" Type="Edm.Int32" Nullable="false"/>
        <Property Name="Sku" Type="Edm.String"/>
        <Property Name="Quantity" Type="Edm.Int32"/>
      </EntityType>

      <EnumType Name="OrderStatus">
        <Member Name="New" Value="0"/>
        <Member Name="Paid" Value="1"/>
        <Member Name="Shipped" Value="2"/>
      </EnumType>

      <Action Name="Cancel" IsBound="true">
        <Parameter Name="order" Type="Shop.Order"/>
        <Parameter Name="Reason" Type="Edm.String"/>
      </Action>

      <EntityContainer Name="Container">
        <EntitySet Name="Orders" EntityType="Shop.Order">
          <NavigationPropertyBinding Path="Customer" Target="Customers"/>
        </EntitySet>
        <EntitySet Name="Customers" EntityType="Shop.Customer">
          <NavigationPropertyBinding Path="Orders" Target="Orders"/>
        </EntitySet>
      </EntityContainer>

    </Schema>
  </edmx:DataServices>
</edmx:Edmx>
```

| Элемент CSDL | Назначение |
|---|---|
| `EntityType` | Тип сущности с ключом (`Key`) и свойствами |
| `ComplexType` | Структурный тип без ключа (адрес, сумма с валютой) |
| `EnumType` | Перечисление |
| `Property` | Свойство: тип `Edm.*`, `Nullable`, `MaxLength`, `Precision`, `Scale` |
| `NavigationProperty` | Связь с другой сущностью или коллекцией |
| `Action` | Операция с побочными эффектами, вызывается `POST` |
| `Function` | Операция без побочных эффектов, вызывается `GET`, может участвовать в запросах |
| `EntityContainer` | Точки входа: `EntitySet`, `Singleton`, `ActionImport`, `FunctionImport` |
| `Annotation` | Дополнительные метаданные: описания, ограничения (только чтение, фильтруемость полей), UI-подсказки (широко используется в SAP Fiori) |

Основные примитивные типы: `Edm.String`, `Edm.Int32`, `Edm.Int64`, `Edm.Decimal`, `Edm.Double`, `Edm.Boolean`, `Edm.Guid`, `Edm.Date`, `Edm.TimeOfDay`, `Edm.DateTimeOffset`, `Edm.Duration`, `Edm.Binary`.

::: tip $metadata — главный артефакт для аналитика
Из `$metadata` видно всё: какие сущности доступны, какие у них поля и типы, обязательность, длины строк, связи и операции. Для крупных систем (SAP, Dynamics) документ огромный — ищите нужный `EntityType` по имени. Приложите к постановке ссылку на `$metadata` конкретного стенда и выдержку с используемыми типами.
:::

## Системные параметры запроса {#query-options}

| Параметр | Назначение | Пример |
|---|---|---|
| `$filter` | Фильтрация | `$filter=Status eq 'Paid' and Total gt 1000` |
| `$select` | Выбор полей | `$select=Id,Number,Total` |
| `$expand` | Включение связанных сущностей | `$expand=Customer($select=Name)` |
| `$orderby` | Сортировка | `$orderby=CreatedAt desc,Id` |
| `$top` | Максимум элементов | `$top=50` |
| `$skip` | Пропустить N элементов | `$skip=100` |
| `$count` | Добавить общее количество (`@odata.count`) | `$count=true` |
| `$search` | Полнотекстовый поиск (если поддерживается) | `$search=ноутбук AND NOT чехол` |
| `$apply` | Агрегация и группировка (расширение Data Aggregation) | `$apply=groupby((Status),aggregate(Total with sum as Sum))` |
| `$compute` | Вычисляемые свойства (v4.01) | `$compute=Price mul Quantity as LineTotal` |
| `$format` | Формат ответа (альтернатива `Accept`) | `$format=json` |
| `$skiptoken` | Токен серверной пагинации (формирует сервер) | из `@odata.nextLink` |
| `$deltatoken` | Получение изменений с прошлого запроса (delta) | из `@odata.deltaLink` |

Параметры можно комбинировать. Порядок применения при обработке: `$filter` → `$orderby` → `$skip` → `$top` → `$select` и `$expand`. Если задан `$apply`, он выполняется раньше остальных.

### $filter — операторы

| Оператор | Значение | Пример |
|---|---|---|
| `eq` | Равно | `Status eq 'Paid'` |
| `ne` | Не равно | `Status ne 'Cancelled'` |
| `gt` | Больше | `Total gt 1000` |
| `ge` | Больше или равно | `CreatedAt ge 2026-01-01T00:00:00Z` |
| `lt` | Меньше | `Quantity lt 10` |
| `le` | Меньше или равно | `Total le 5000.00` |
| `and` | Логическое И | `Total gt 100 and Total lt 500` |
| `or` | Логическое ИЛИ | `Status eq 'New' or Status eq 'Paid'` |
| `not` | Отрицание | `not contains(Name,'тест')` |
| `in` | Входит в список (v4.01) | `Status in ('New','Paid')` |
| `has` | Содержит флаг перечисления | `Flags has Shop.Flags'Urgent'` |
| `add`, `sub`, `mul`, `div`, `mod` | Арифметика | `Price mul Quantity gt 10000` |
| `( )` | Группировка | `(Status eq 'New' or Status eq 'Paid') and Total gt 0` |

### $filter — функции

| Группа | Функции | Пример |
|---|---|---|
| Строки | `contains`, `startswith`, `endswith`, `length`, `indexof`, `substring`, `tolower`, `toupper`, `trim`, `concat` | `startswith(Number,'2026-')`, `tolower(Name) eq 'ромашка'` |
| Дата и время | `year`, `month`, `day`, `hour`, `minute`, `second`, `date`, `time`, `now`, `maxdatetime`, `mindatetime` | `year(CreatedAt) eq 2026`, `CreatedAt lt now()` |
| Математика | `round`, `floor`, `ceiling` | `round(Total) eq 1500` |
| Типы | `cast`, `isof` | `isof(Shop.VipCustomer)` |
| Коллекции (лямбда) | `any`, `all` | `Items/any(i: i/Quantity gt 10)` |
| Null | сравнение с `null` | `Comment eq null` |

### Примеры URL

```http
# Оплаченные заказы на сумму больше 1000 за 2026 год, только нужные поля, по убыванию даты
GET /odata/Orders?$filter=Status eq 'Paid' and Total gt 1000 and year(CreatedAt) eq 2026&$select=Id,Number,Total,CreatedAt&$orderby=CreatedAt desc&$top=50&$count=true

# Заказ с клиентом и позициями (вложенные параметры в $expand разделяются точкой с запятой)
GET /odata/Orders(42)?$expand=Customer($select=Name,Inn),Items($orderby=LineNo;$top=100)

# Клиенты, у которых есть заказ больше 100 000
GET /odata/Customers?$filter=Orders/any(o: o/Total gt 100000)&$select=Id,Name

# Поиск по подстроке без учёта регистра
GET /odata/Customers?$filter=contains(tolower(Name),'ромашка')

# Строка с апострофом: одинарная кавычка удваивается
GET /odata/Customers?$filter=Name eq 'O''Neil'

# Сумма заказов по статусам
GET /odata/Orders?$apply=groupby((Status),aggregate(Total with sum as TotalSum,$count as Cnt))

# Количество заказов (ответ — простое число)
GET /odata/Orders/$count?$filter=Status eq 'New'
```

::: warning Кодирование URL
В реальных запросах пробелы, кавычки, `$` и кириллица кодируются: `$filter=Status%20eq%20%27Paid%27`. Большинство клиентов делают это автоматически, но при ручной сборке URL (в шине, в скриптах) это частая причина ошибок `400 Bad Request`.
:::

### Ответ на запрос коллекции

```json
{
  "@odata.context": "https://erp.example.com/odata/$metadata#Orders(Id,Number,Total,CreatedAt)",
  "@odata.count": 1342,
  "value": [
    { "@odata.etag": "W/\"7\"", "Id": 42, "Number": "2026-000042", "Total": 1500.00, "CreatedAt": "2026-10-01T10:15:00Z" },
    { "@odata.etag": "W/\"3\"", "Id": 43, "Number": "2026-000043", "Total": 2300.50, "CreatedAt": "2026-10-01T09:02:11Z" }
  ],
  "@odata.nextLink": "https://erp.example.com/odata/Orders?$filter=...&$skiptoken=43"
}
```

| Аннотация | Значение |
|---|---|
| `@odata.context` | Ссылка на описание структуры ответа в `$metadata` |
| `@odata.count` | Общее количество (если запрошен `$count=true`) |
| `@odata.nextLink` | Ссылка на следующую страницу (серверная пагинация) |
| `@odata.deltaLink` | Ссылка для получения изменений |
| `@odata.etag` | Версия сущности для [оптимистичной блокировки](/design/concurrency) |
| `@odata.id`, `@odata.type` | Идентификатор и тип сущности (зависят от уровня метаданных в `Accept`: `odata.metadata=minimal`, `full`, `none`) |

::: tip Пагинация: следуйте за nextLink
Сервер может ограничить размер страницы сам (server-driven paging), даже если клиент не указал `$top`. Клиент должен забирать данные, пока в ответе есть `@odata.nextLink`, и не собирать ссылку самостоятельно. Желаемый размер страницы можно передать заголовком `Prefer: odata.maxpagesize=500`. Общие принципы — в разделе [Пагинация](/design/pagination).
:::

## Изменение данных {#crud}

| Операция | Запрос | Ответ |
|---|---|---|
| Создание | `POST /odata/Orders` | `201 Created` + `Location` (или `204` при `Prefer: return=minimal`) |
| Частичное обновление | `PATCH /odata/Orders(42)` | `204 No Content` или `200 OK` при `Prefer: return=representation` |
| Полная замена | `PUT /odata/Orders(42)` | `204 No Content` или `200 OK` |
| Удаление | `DELETE /odata/Orders(42)` | `204 No Content` |
| Создание связи | `POST /odata/Customers(...)/Orders/$ref` | `204 No Content` |
| Вызов действия | `POST /odata/Orders(42)/Shop.Cancel` | `200 OK` или `204 No Content` |
| Вызов функции | `GET /odata/Products/Shop.TopSelling(count=10)` | `200 OK` |

```http
PATCH /odata/Orders(42) HTTP/1.1
Host: erp.example.com
Content-Type: application/json
OData-Version: 4.0
If-Match: W/"7"
Prefer: return=representation

{ "Status": "Shipped" }
```

```http
POST /odata/Orders(42)/Shop.Cancel HTTP/1.1
Content-Type: application/json

{ "Reason": "Клиент отказался" }
```

### Формат ошибки

```json
{
  "error": {
    "code": "ORDER_ALREADY_SHIPPED",
    "message": "Заказ 42 уже отгружен и не может быть отменён",
    "target": "Orders(42)",
    "details": [
      { "code": "STATUS", "message": "Текущий статус: Shipped", "target": "Status" }
    ],
    "innererror": { "traceId": "4bf92f3577b34da6" }
  }
}
```

Используются обычные HTTP-коды: `400`, `401`, `403`, `404`, `409`, `412 Precondition Failed` (не совпал `If-Match`), `501 Not Implemented` (параметр запроса не поддерживается). Формат тела ошибки определён стандартом OData и отличается от [RFC 9457](/design/errors).

## Пакетные запросы ($batch) {#batch}

`$batch` позволяет отправить несколько операций одним HTTP-запросом. Изменения можно объединить в **набор изменений (changeset)**, который выполняется атомарно: либо все, либо ни одного.

```http
POST /odata/$batch HTTP/1.1
Host: erp.example.com
OData-Version: 4.0
Content-Type: multipart/mixed; boundary=batch_1

--batch_1
Content-Type: application/http
Content-Transfer-Encoding: binary

GET Orders(42)?$select=Id,Status HTTP/1.1
Accept: application/json

--batch_1
Content-Type: multipart/mixed; boundary=changeset_1

--changeset_1
Content-Type: application/http
Content-Transfer-Encoding: binary
Content-ID: 1

POST Customers HTTP/1.1
Content-Type: application/json

{"Name": "ООО Ромашка", "Inn": "7701234567"}

--changeset_1
Content-Type: application/http
Content-Transfer-Encoding: binary
Content-ID: 2

POST $1/Orders HTTP/1.1
Content-Type: application/json

{"Number": "2026-000044", "Total": 990.00}

--changeset_1--
--batch_1--
```

Ссылка `$1` указывает на результат части с `Content-ID: 1` — заказ создаётся у только что созданного клиента.

В OData 4.01 появился JSON-формат пакета:

```json
{
  "requests": [
    { "id": "1", "atomicityGroup": "g1", "method": "POST", "url": "Customers",
      "headers": { "content-type": "application/json" },
      "body": { "Name": "ООО Ромашка", "Inn": "7701234567" } },
    { "id": "2", "atomicityGroup": "g1", "dependsOn": ["1"], "method": "POST", "url": "$1/Orders",
      "headers": { "content-type": "application/json" },
      "body": { "Number": "2026-000044", "Total": 990.00 } },
    { "id": "3", "method": "GET", "url": "Orders(42)?$select=Id,Status" }
  ]
}
```

```mermaid
sequenceDiagram
    participant C as Клиент
    participant S as OData-сервис
    C->>S: POST $batch из GET и changeset из двух POST
    S->>S: GET Orders 42
    S->>S: Начало транзакции changeset
    S->>S: POST Customers
    S->>S: POST Orders для нового клиента
    S->>S: Фиксация транзакции
    S-->>C: 200 OK, multipart-ответ с результатом каждой части
```

::: warning Ответ на $batch — почти всегда 200
Сам пакет возвращает `200 OK`, а статусы отдельных операций находятся внутри частей ответа. Клиент обязан разбирать каждую часть. Подробнее о пакетных операциях в целом — в разделе [Пакетные операции](/design/bulk).
:::

## Где встречается {#usage}

| Платформа | Версия OData | Особенности |
|---|---|---|
| **SAP** (SAP Gateway, S/4HANA, SAP BTP) | v2 (большинство стандартных API), v4 (новые сервисы на RAP) | Стандартные API публикуются в SAP Business Accelerator Hub; широко используются аннотации для Fiori; CSRF-токен для изменяющих запросов (`X-CSRF-Token: Fetch`) |
| **Microsoft Dynamics 365 / Dataverse** | v4 | Web API по адресу вида `/api/data/v9.2/accounts`; OAuth 2.0 через Microsoft Entra ID |
| **Microsoft Graph** | v4 (с особенностями) | `$select`, `$filter`, `$expand`, `$top`; для части запросов нужен заголовок `ConsistencyLevel: eventual` |
| **SharePoint** | v3/v4 | REST API на основе OData |
| **1С:Предприятие** | v3 | Стандартный интерфейс OData: `/<база>/odata/standard.odata/` |
| **BI и аналитика** | разные | Power BI, Excel, Tableau умеют читать OData-фиды напрямую |

### OData в 1С {#odata-1c}

Платформа 1С:Предприятие 8.3 предоставляет **стандартный интерфейс OData** (реализует протокол OData версии 3.0). Он открывает доступ к объектам конфигурации без программирования веб-сервисов.

- Публикация базы на веб-сервере с включённым OData; состав доступных объектов задаётся методом `УстановитьСоставСтандартногоИнтерфейсаOData()` (по умолчанию ничего не опубликовано).
- Имена наборов формируются по виду и имени объекта метаданных: `Catalog_Контрагенты`, `Document_ЗаказКлиента`, `InformationRegister_ЦеныНоменклатуры`, `AccumulationRegister_ТоварыНаСкладах`.
- Ключ — GUID ссылки: `Catalog_Контрагенты(guid'...')`.
- Формат по умолчанию — Atom/XML; JSON запрашивается через `$format=json`.
- Аутентификация обычно Basic по пользователю информационной базы; права определяются ролями пользователя 1С.

```http
GET /trade/odata/standard.odata/Catalog_Контрагенты?$format=json&$filter=ИНН eq '7701234567'&$select=Ref_Key,Description,ИНН HTTP/1.1
Host: 1c.example.local
Authorization: Basic aW50ZWdyYXRpb246c2VjcmV0
```

::: warning Ограничения стандартного интерфейса 1С
Стандартный OData-интерфейс работает с данными напрямую и не выполняет прикладную логику, которую разработчики заложили в формы и обработки. Запись через него может обойти бизнес-проверки. Для изменения данных часто правильнее заказать у команды 1С HTTP-сервис с явным контрактом. Также учитывайте нагрузку: тяжёлые `$filter` и `$expand` по большим таблицам могут влиять на работу пользователей.
:::

## OData v2 и v4: основные различия {#v2-vs-v4}

Многие корпоративные интеграции (особенно SAP) всё ещё на v2. Признаки и отличия:

| Признак | OData v2 | OData v4 |
|---|---|---|
| Обёртка JSON | `{"d": {"results": [ ... ] } }` | `{"value": [...]}` |
| Количество | `$inlinecount=allpages`, поле `__count` | `$count=true`, поле `@odata.count` |
| Поиск подстроки | `substringof('abc',Name)` | `contains(Name,'abc')` |
| Литерал даты | `datetime'2026-01-01T00:00:00'` | `2026-01-01T00:00:00Z` (без кавычек) |
| Литерал GUID | `guid'...'` | без префикса и кавычек |
| Частичное обновление | `MERGE` (или `PATCH`) | `PATCH` |
| Агрегация | Нет (в SAP — через аннотации) | `$apply` |
| Метаданные | EDMX версии 1.0 | EDMX/CSDL версии 4.0, CSDL JSON в 4.01 |
| Заголовок версии | `DataServiceVersion` | `OData-Version` |

## Плюсы и минусы {#pros-cons}

| Плюсы | Минусы |
|---|---|
| Единый стандартный язык запросов: не нужно изобретать фильтрацию, сортировку, пагинацию | Сложность стандарта: полная реализация сервера трудоёмка, поддержка возможностей у серверов разная |
| Машиночитаемые метаданные, генерация клиентов, поддержка в BI-инструментах | Клиент может построить очень тяжёлый запрос (`$expand` нескольких уровней, `$filter` по неиндексированным полям) |
| Штатный интерфейс крупных ERP и CRM | Модель данных сервера «просвечивает» наружу, высокая связанность с внутренней структурой |
| Пакетные запросы с атомарными наборами изменений | Длинные и сложные URL, проблемы кодирования |
| Стандартные ETag, delta-запросы, серверная пагинация | Меньше популярен вне экосистем Microsoft и SAP, меньше специалистов |
| Отлично подходит для отчётности и аналитики | Формат ошибок не совпадает с RFC 9457, различия между версиями v2, v3, v4 |

## OData и GraphQL {#vs-graphql}

Обе технологии дают клиенту гибкость в выборе полей и связанных данных, но устроены по-разному.

| Критерий | OData | GraphQL |
|---|---|---|
| Основа | REST: ресурсы, HTTP-методы, URL | Собственный язык запросов, один эндпоинт |
| Выбор полей | `$select` | Список полей в запросе |
| Связанные данные | `$expand` | Вложенные поля |
| Фильтрация, сортировка, пагинация | Стандартизированы протоколом | Не стандартизированы — каждая схема определяет свои аргументы |
| Агрегация | `$apply` | Нет стандарта |
| Метаданные | `$metadata` (CSDL) | Интроспекция (SDL) |
| HTTP-кэширование | Работает для `GET` | Почти не работает |
| Коды ошибок | HTTP-коды | `200` + `errors` |
| Подписки, real-time | Нет (есть delta-запросы) | Подписки |
| Типичная среда | ERP, CRM, BI, корпоративные данные | Веб и мобильные клиенты, агрегирующие фасады |
| Порог входа | Средний | Средний |

Кратко: OData сильнее как стандартный протокол доступа к табличным корпоративным данным и для BI; [GraphQL](/protocols/graphql) — как гибкий контракт между фронтендом и бэкендом.

## Когда применять {#when}

**OData подходит, если:**
- интеграция с SAP, Dynamics 365, Microsoft Graph, 1С — используйте их штатный OData-интерфейс;
- нужно дать аналитикам и BI-инструментам гибкий доступ к данным на чтение;
- внутренний API на платформе со зрелой поддержкой OData (ASP.NET Core OData, SAP CAP), где выгодно получить фильтрацию и пагинацию «бесплатно».

**OData не стоит выбирать, если:**
- публичный API для широкого круга партнёров — привычнее [REST](/protocols/rest) с явными параметрами фильтрации (см. [Фильтрация и сортировка](/design/filtering));
- важно жёстко контролировать нагрузку и набор допустимых запросов;
- нужно скрыть внутреннюю модель данных от потребителей.

## На что обратить внимание аналитику {#analyst-checklist}

- Указана версия OData (v2, v3, v4) — от неё зависят формат JSON, литералы и функции фильтра.
- Приложен адрес `$metadata` для каждого стенда; перечислены используемые наборы сущностей, поля, типы и связи.
- Для каждого запроса зафиксированы конкретные `$filter`, `$select`, `$expand`, `$orderby` — не «забирать всё», а только нужные поля.
- Описана пагинация: клиент следует за `@odata.nextLink`, указан желаемый размер страницы.
- Для инкрементальной загрузки определён механизм: фильтр по дате изменения или delta-запросы (`@odata.deltaLink`).
- Описаны оптимистичная блокировка (`@odata.etag`, `If-Match`) и поведение при `412 Precondition Failed`.
- Для пакетных операций описаны состав changeset, атомарность и разбор статусов отдельных частей ответа.
- Определена аутентификация: Basic (1С), OAuth 2.0 (Dynamics, Graph), SAP-специфика (CSRF-токен для изменяющих запросов).
- Согласованы с владельцем системы допустимая нагрузка, ограничения на `$top`, глубину `$expand` и запрет тяжёлых фильтров.
- Для 1С: выяснено, опубликованы ли нужные объекты в стандартном интерфейсе OData и не обходит ли запись бизнес-логику.
- Описан разбор ошибок OData (`error.code`, `error.details`) и перечень ожидаемых кодов.

## Стандарты и ссылки {#references}

- [OData Version 4.01 — Part 1: Protocol (OASIS)](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html)
- [OData Version 4.01 — Part 2: URL Conventions (OASIS)](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html)
- [OData Common Schema Definition Language (CSDL) XML Representation 4.01](https://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/odata-csdl-xml-v4.01.html)
- [OData JSON Format Version 4.01](https://docs.oasis-open.org/odata/odata-json-format/v4.01/odata-json-format-v4.01.html)
- [OData Extension for Data Aggregation Version 4.0](https://docs.oasis-open.org/odata/odata-data-aggregation-ext/v4.0/odata-data-aggregation-ext-v4.0.html)
- [OData.org — документация и учебные материалы](https://www.odata.org/documentation/)
- [Microsoft Dataverse Web API](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview)
- [SAP Business Accelerator Hub](https://api.sap.com/)
- [1С:Предприятие — стандартный интерфейс OData (документация платформы)](https://its.1c.ru/db/v8doc)
