# OAuth 2.0 и OpenID Connect

OAuth 2.0 (RFC 6749) — протокол **делегированной авторизации**: клиент получает ограниченный по правам и времени токен доступа вместо пароля. OpenID Connect (OIDC) — надстройка над OAuth 2.0 для **аутентификации пользователя** (ID Token). В интеграциях server-to-server чаще всего используется грант Client Credentials, в пользовательских приложениях — Authorization Code + PKCE.

## Роли {#roles}

| Роль | Кто это | Пример |
|---|---|---|
| **Resource Owner** (владелец ресурса) | Тот, кто может разрешить доступ к данным — обычно пользователь | Клиент банка |
| **Client** (клиент) | Приложение, которое хочет получить доступ | Мобильное приложение, сервис партнёра |
| **Authorization Server** (сервер авторизации, AS) | Аутентифицирует, получает согласие, выдаёт токены | Keycloak, Auth0, Okta, Microsoft Entra ID |
| **Resource Server** (ресурсный сервер, RS) | API, которое принимает токены и отдаёт данные | `api.example.com` |

## Типы клиентов {#client-types}

| Тип | Может хранить секрет? | Примеры | Аутентификация клиента на token endpoint |
|---|---|---|---|
| **Confidential** (конфиденциальный) | Да — код и секрет на сервере | Бэкенд веб-приложения, сервис партнёра, BFF | `client_secret_basic`, `client_secret_post`, `private_key_jwt`, `tls_client_auth` (mTLS) |
| **Public** (публичный) | Нет — код у пользователя, его можно декомпилировать | SPA, мобильное и десктопное приложение, CLI | Нет (`none`), защита — PKCE и точные redirect URI |

Способы аутентификации конфиденциального клиента по возрастанию надёжности:

| Метод | Как работает |
|---|---|
| `client_secret_basic` | `client_id:client_secret` в заголовке `Authorization: Basic ...` |
| `client_secret_post` | `client_id` и `client_secret` в теле запроса |
| `client_secret_jwt` | JWT-утверждение, подписанное HMAC на секрете клиента |
| `private_key_jwt` | JWT-утверждение (RFC 7523), подписанное закрытым ключом клиента; у AS только открытый ключ |
| `tls_client_auth` / `self_signed_tls_client_auth` | Клиентский сертификат при mTLS (RFC 8705) |

## Гранты (потоки) {#grants}

| Грант | Для кого | Статус |
|---|---|---|
| Authorization Code + PKCE | Пользователь + любое приложение (веб, SPA, мобильное) | Основной для пользователей |
| Client Credentials | Система — система, без пользователя | Основной для интеграций |
| Device Authorization | Устройства без браузера или с неудобным вводом | Актуален |
| Refresh Token | Продление доступа без повторного входа | Актуален, с ротацией |
| Token Exchange | Обмен токена на другой (делегирование между сервисами) | Актуален |
| Implicit | Раньше — SPA | **Устарел, запрещён** в OAuth 2.1 и RFC 9700 |
| Resource Owner Password Credentials | Раньше — «доверенные» приложения | **Устарел, запрещён** в OAuth 2.1 и RFC 9700 |

### Authorization Code + PKCE {#authorization-code}

Пользователь входит на сервере авторизации, а приложение получает одноразовый код и обменивает его на токены. PKCE (RFC 7636, Proof Key for Code Exchange) защищает от перехвата кода: только тот, кто начал поток, знает `code_verifier`.

```mermaid
sequenceDiagram
    participant U as Пользователь
    participant C as Клиент
    participant AS as Сервер авторизации
    participant RS as API
    C->>C: Сгенерировать code_verifier, state, nonce
    C->>C: code_challenge = BASE64URL от SHA256 code_verifier
    C->>U: Редирект на authorize с code_challenge и state
    U->>AS: GET authorize
    AS->>U: Страница входа и согласия
    U->>AS: Логин, пароль, MFA, согласие
    AS->>U: Редирект на redirect_uri с code и state
    U->>C: GET callback с code и state
    C->>C: Проверить state
    C->>AS: POST token с code и code_verifier
    AS->>AS: Проверить SHA256 code_verifier = code_challenge
    AS-->>C: access_token, refresh_token, id_token
    C->>RS: GET ресурс с Authorization Bearer
    RS-->>C: 200 OK
```

**Шаг 1. Генерация PKCE.** `code_verifier` — случайная строка 43–128 символов из `[A-Z a-z 0-9 - . _ ~]`; `code_challenge = BASE64URL(SHA256(code_verifier))`, метод `S256` (метод `plain` использовать не следует).

```text
code_verifier  = dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
code_challenge = E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
```

**Шаг 2. Запрос авторизации** (браузер пользователя перенаправляется на AS):

```http
GET /authorize?response_type=code
  &client_id=shop-web
  &redirect_uri=https%3A%2F%2Fshop.example.com%2Fcallback
  &scope=openid%20profile%20orders%3Aread
  &state=af0ifjsldkj
  &nonce=n-0S6_WzA2Mj
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256 HTTP/1.1
Host: auth.example.com
```

Переносы строк в URL — только для читаемости.

**Шаг 3. Ответ AS** — редирект обратно с кодом (живёт обычно до минуты, одноразовый):

```http
HTTP/1.1 302 Found
Location: https://shop.example.com/callback?code=SplxlOBeZQQYbYS6WxSbIA&state=af0ifjsldkj
```

Клиент **обязан** сравнить `state` с сохранённым значением (защита от CSRF).

**Шаг 4. Обмен кода на токены:**

```http
POST /token HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic c2hvcC13ZWI6c2VjcmV0

grant_type=authorization_code
&code=SplxlOBeZQQYbYS6WxSbIA
&redirect_uri=https%3A%2F%2Fshop.example.com%2Fcallback
&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

Для публичного клиента заголовка `Authorization` нет, вместо него в теле передаётся `client_id`.

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6ImF0K2p3dCJ9...",
  "token_type": "Bearer",
  "expires_in": 300,
  "refresh_token": "8xLOxBtZp8",
  "scope": "openid profile orders:read",
  "id_token": "eyJhbGciOiJSUzI1NiJ9..."
}
```

### Client Credentials — основной грант для интеграций {#client-credentials}

Пользователя нет: клиент (сервис партнёра, внутренняя система) получает токен от своего имени. Права определяются настройками клиента на AS и запрошенными scopes.

```mermaid
sequenceDiagram
    participant C as Система-клиент
    participant AS as Сервер авторизации
    participant RS as API
    C->>AS: POST token, grant_type client_credentials, scope
    AS->>AS: Аутентифицировать клиента, проверить разрешённые scopes
    AS-->>C: access_token, expires_in 300
    Note over C: Кэшировать токен до истечения
    loop Пока токен действителен
        C->>RS: Запрос с Authorization Bearer
        RS->>RS: Проверить подпись, exp, iss, aud, scope
        RS-->>C: 200 OK
    end
    Note over C: За 30-60 секунд до exp или при 401
    C->>AS: POST token, новый токен
    AS-->>C: access_token
```

::: code-group

```http [client_secret_basic]
POST /token HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic cGFydG5lci1hY21lOnMzY3IzdA==

grant_type=client_credentials&scope=orders%3Aread%20orders%3Awrite
```

```http [private_key_jwt]
POST /token HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&scope=orders%3Aread%20orders%3Awrite
&client_assertion_type=urn%3Aietf%3Aparams%3Aoauth%3Aclient-assertion-type%3Ajwt-bearer
&client_assertion=eyJhbGciOiJSUzI1NiIsImtpZCI6InBhcnRuZXIta2V5LTEifQ...
```

```bash [curl]
curl -X POST https://auth.example.com/token \
  -u "partner-acme:s3cr3t" \
  -d grant_type=client_credentials \
  -d "scope=orders:read orders:write"
```

:::

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjIwMjYtMTAifQ...",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "orders:read orders:write"
}
```

Особенности:

- refresh token в этом гранте не выдаётся (RFC 6749 4.4.3) — клиент просто запрашивает новый access token;
- **токен нужно кэшировать** и переиспользовать до истечения. Запрос токена перед каждым вызовом API — частая ошибка, которая перегружает AS и приводит к лимитам;
- обновлять заранее (за 30–60 секунд до `expires_in`), а при 401 — один раз получить новый токен и повторить запрос;
- в Keycloak `client_id` — это клиент с включённым Service Accounts; в Entra ID scope записывается как `api://идентификатор-приложения/.default`.

Ошибка аутентификации клиента:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="token"
Content-Type: application/json
Cache-Control: no-store

{"error": "invalid_client", "error_description": "Client authentication failed"}
```

Коды ошибок token endpoint (RFC 6749 5.2): `invalid_request`, `invalid_client`, `invalid_grant`, `unauthorized_client`, `unsupported_grant_type`, `invalid_scope`. Код ответа — [400](/http/status-codes#400); для `invalid_client` допустим [401](/http/status-codes#401), а если клиент аутентифицировался через заголовок `Authorization`, то 401 с `WWW-Authenticate` обязателен.

### Device Authorization Grant {#device}

RFC 8628. Для устройств без браузера или клавиатуры (Smart TV, терминалы, CLI): устройство показывает код, пользователь подтверждает вход на телефоне или компьютере.

```mermaid
sequenceDiagram
    participant D as Устройство
    participant AS as Сервер авторизации
    participant U as Пользователь на телефоне
    D->>AS: POST device_authorization, client_id, scope
    AS-->>D: device_code, user_code, verification_uri, interval 5
    D->>U: Показать адрес и код WDJB-MJHT
    U->>AS: Открыть verification_uri, ввести код, войти, согласиться
    loop Каждые interval секунд
        D->>AS: POST token, grant_type device_code
        AS-->>D: 400 authorization_pending
    end
    D->>AS: POST token, grant_type device_code
    AS-->>D: access_token, refresh_token
```

```http
POST /device_authorization HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded

client_id=tv-app&scope=profile
```

```json
{
  "device_code": "GmRhmhcxhwAzkoEqiMEg_DnyEysNkuNhszIySk9eS",
  "user_code": "WDJB-MJHT",
  "verification_uri": "https://auth.example.com/device",
  "verification_uri_complete": "https://auth.example.com/device?user_code=WDJB-MJHT",
  "expires_in": 1800,
  "interval": 5
}
```

Опрос: `grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=...&client_id=tv-app`. Ошибки при опросе: `authorization_pending` (ждать), `slow_down` (увеличить интервал на 5 секунд), `access_denied`, `expired_token`.

### Refresh Token и ротация {#refresh-token}

Access token живёт минуты, refresh token — часы или дни и позволяет получить новый access token без участия пользователя.

```http
POST /token HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=8xLOxBtZp8&client_id=mobile-app
```

**Ротация refresh token:** при каждом использовании AS выдаёт новый refresh token, а старый становится недействительным. Если старый токен предъявлен повторно — это признак кражи, и AS отзывает всё «семейство» токенов.

```mermaid
sequenceDiagram
    participant C as Клиент
    participant X as Злоумышленник
    participant AS as Сервер авторизации
    C->>AS: refresh_token RT1
    AS-->>C: access_token, RT2, RT1 погашен
    X->>AS: refresh_token RT1 украденный
    AS->>AS: RT1 уже использован, обнаружен повтор
    AS-->>X: 400 invalid_grant
    AS->>AS: Отозвать RT2 и всё семейство
    C->>AS: refresh_token RT2
    AS-->>C: 400 invalid_grant, нужен повторный вход
```

Для публичных клиентов OAuth 2.1 требует либо ротацию refresh token, либо привязку к клиенту (DPoP, mTLS). Учитывайте гонки: если несколько потоков приложения одновременно обновляют токен, один из них получит `invalid_grant` — обновление должно быть синхронизировано, а AS может давать короткий льготный период.

### Token Exchange {#token-exchange}

RFC 8693. Сервис обменивает имеющийся токен на новый — с другой аудиторией, суженными правами или для вызова следующего сервиса от имени пользователя (делегирование в цепочке микросервисов).

```mermaid
sequenceDiagram
    participant C as Клиент
    participant A as Сервис заказов
    participant AS as Сервер авторизации
    participant B as Сервис платежей
    C->>A: Запрос с токеном aud orders
    A->>AS: token-exchange, subject_token, audience payments
    AS-->>A: Новый токен aud payments, sub пользователя
    A->>B: Запрос с новым токеном
    B-->>A: 200 OK
    A-->>C: 200 OK
```

```http
POST /token HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic b3JkZXJzLXN2YzpzZWNyZXQ=

grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange
&subject_token=eyJhbGciOiJSUzI1NiJ9...
&subject_token_type=urn%3Aietf%3Aparams%3Aoauth%3Atoken-type%3Aaccess_token
&audience=payments-api
&scope=payments%3Acreate
```

Ответ дополнительно содержит `issued_token_type`. Так вместо «прокидывания» исходного токена с широкой аудиторией каждый сервис получает токен, пригодный только для следующего звена.

### Устаревшие гранты: Implicit и Password {#deprecated}

| Грант | Как работал | Почему нельзя |
|---|---|---|
| **Implicit** (`response_type=token`) | Access token возвращался сразу во фрагменте URL редиректа | Токен в URL: утечки через историю, `Referer`, расширения браузера; нет аутентификации клиента и нет PKCE; невозможно привязать токен к клиенту. Замена — Authorization Code + PKCE |
| **Resource Owner Password Credentials** (`grant_type=password`) | Приложение собирает логин и пароль пользователя и отправляет на AS | Приложение видит пароль пользователя; несовместимо с MFA, федерацией и SSO; приучает пользователей вводить пароль куда угодно. Замена — Authorization Code + PKCE, для устройств — Device Grant |

RFC 9700 (OAuth 2.0 Security BCP): Implicit «не следует» использовать, ROPC «не должен» использоваться; в OAuth 2.1 оба гранта исключены.

## Токены: access, refresh, ID {#tokens}

| | Access token | Refresh token | ID token (OIDC) |
|---|---|---|---|
| Назначение | Доступ к API | Получение нового access token | Сведения о факте аутентификации пользователя |
| Получатель (аудитория) | Resource Server | Только Authorization Server | Клиент |
| Формат | Opaque или JWT (профиль RFC 9068, `typ: at+jwt`) | Обычно opaque | Всегда JWT |
| Срок жизни | Короткий: 5–60 минут | Долгий: часы–дни, с ротацией | Короткий, используется сразу после входа |
| Куда передаётся | `Authorization: Bearer` в API | В тело запроса на token endpoint | Никуда — проверяется и используется клиентом |
| Ошибка использования | Хранить долго, логировать | Отправлять в API, хранить без защиты | **Использовать как access token для API** |

### Scopes и audience {#scopes-audience}

- **Scope** — какие права делегированы клиенту: `orders:read`, `payments:create`. Записываются через пробел. AS может выдать меньше, чем запрошено — фактический набор возвращается в поле `scope`.
- **Audience** (`aud`) — для какого ресурсного сервера предназначен токен. Каждый API должен **отвергать токены, выпущенные для другого API**, иначе токен от одного сервиса можно предъявить другому. Указывается через параметр `resource` (RFC 8707) или `audience` (зависит от продукта).

Рекомендации по именованию scopes: `ресурс:действие`, без избыточной детализации, явная документация каждого scope. Для сложных прав (сумма платежа, конкретный счёт) есть Rich Authorization Requests (RFC 9396, параметр `authorization_details`).

## Introspection, revocation, JWKS, discovery {#endpoints}

| Endpoint | Стандарт | Назначение |
|---|---|---|
| `/authorize` | RFC 6749 | Взаимодействие с пользователем, выдача кода |
| `/token` | RFC 6749 | Выдача токенов по всем грантам |
| `/introspect` | RFC 7662 | RS проверяет opaque-токен: активен ли, какие scopes |
| `/revoke` | RFC 7009 | Отзыв refresh или access token (при выходе, отключении интеграции) |
| JWKS (`jwks_uri`) | RFC 7517 | Открытые ключи AS для проверки подписи JWT |
| `/userinfo` | OIDC Core | Профиль пользователя по access token |
| `/.well-known/openid-configuration` | OIDC Discovery | Метаданные: адреса всех endpoint, алгоритмы, поддерживаемые гранты |
| `/.well-known/oauth-authorization-server` | RFC 8414 | То же для «чистого» OAuth 2.0 |
| `/par` | RFC 9126 | Pushed Authorization Requests |
| `/device_authorization` | RFC 8628 | Начало Device Grant |

**Introspection** — вызывающий RS тоже должен аутентифицироваться:

```http
POST /introspect HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic b3JkZXJzLWFwaTpzZWNyZXQ=

token=mF_9.B5f-4.1JqM&token_type_hint=access_token
```

```json
{
  "active": true,
  "client_id": "partner-acme",
  "scope": "orders:read orders:write",
  "sub": "partner-acme",
  "aud": "orders-api",
  "iss": "https://auth.example.com",
  "exp": 1791019200,
  "iat": 1791018900
}
```

Для недействительного токена ответ — просто `{"active": false}` без подробностей.

**Revocation:** `POST /revoke` с `token=...&token_type_hint=refresh_token`. Сервер отвечает `200 OK` даже для неизвестного токена — чтобы не раскрывать информацию.

**Discovery** (фрагмент):

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "userinfo_endpoint": "https://auth.example.com/userinfo",
  "grant_types_supported": ["authorization_code", "client_credentials", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "private_key_jwt"],
  "id_token_signing_alg_values_supported": ["RS256", "ES256"]
}
```

::: tip В спецификацию — адрес discovery
Достаточно указать `issuer` и адрес discovery-документа: клиенты сами получат адреса endpoint и JWKS. Но **`issuer` в токене должен в точности совпадать** с `issuer` из метаданных.
:::

## OpenID Connect {#oidc}

OIDC добавляет к OAuth 2.0 стандартный способ узнать, **кто вошёл**: scope `openid`, ID token, endpoint UserInfo, discovery и стандартные claims.

```mermaid
sequenceDiagram
    participant U as Пользователь
    participant C as Приложение
    participant OP as OpenID Provider
    C->>U: Редирект на authorize, scope openid, state, nonce, PKCE
    U->>OP: Вход и согласие
    OP->>U: Редирект с code и state
    U->>C: callback с code и state
    C->>OP: POST token с code и code_verifier
    OP-->>C: id_token, access_token
    C->>C: Проверить подпись id_token, iss, aud, exp, nonce
    C->>OP: GET userinfo с access_token
    OP-->>C: sub, name, email
```

Декодированный payload ID token:

```json
{
  "iss": "https://auth.example.com",
  "sub": "248289761001",
  "aud": "shop-web",
  "exp": 1791019200,
  "iat": 1791018900,
  "auth_time": 1791018880,
  "nonce": "n-0S6_WzA2Mj",
  "acr": "urn:example:mfa",
  "amr": ["pwd", "otp"],
  "name": "Иван Петров",
  "email": "ivan@example.com"
}
```

| Claim | Смысл |
|---|---|
| `sub` | Неизменный идентификатор пользователя у этого провайдера — использовать для связи учётных записей, **а не email** |
| `aud` | `client_id` приложения — проверять обязательно |
| `nonce` | Значение из запроса — защита от повторного использования ID token |
| `auth_time`, `acr`, `amr` | Когда и как пользователь аутентифицировался (например, с MFA) |
| `azp` | Авторизованная сторона, если аудиторий несколько |
| `at_hash` | Хэш access token для их связи (гибридный поток) |

Стандартные scopes: `openid` (обязательный), `profile`, `email`, `address`, `phone`, `offline_access` (запросить refresh token).

| Параметр | Защищает от | Где проверяется |
|---|---|---|
| `state` | CSRF в redirect: подсунутый чужой код | Клиент сравнивает с сохранённым значением при callback |
| `nonce` | Повторное использование (replay) ID token | Клиент сравнивает с `nonce` в ID token |
| PKCE | Перехват и подмена кода авторизации | AS при обмене кода |

## Усиления безопасности {#hardening}

### PKCE для всех клиентов {#pkce-all}

RFC 9700 рекомендует PKCE и для конфиденциальных клиентов (защищает от инъекции кода), OAuth 2.1 делает его обязательным для Authorization Code.

### Sender-constrained токены: mTLS и DPoP {#sender-constrained}

Обычный bearer-токен работает у любого, кто его украл. Sender-constrained токен привязан к ключу клиента — без закрытого ключа он бесполезен.

| | mTLS-bound (RFC 8705) | DPoP (RFC 9449) |
|---|---|---|
| Привязка к | Клиентскому сертификату TLS | Ключевой паре клиента, доказательство — JWT в заголовке `DPoP` |
| В токене | `cnf` с отпечатком сертификата `x5t#S256` | `cnf` с отпечатком ключа `jkt` |
| Тип токена | `Bearer` | `DPoP` (`Authorization: DPoP ...`) |
| Подходит для | Server-to-server, партнёры с PKI, финансовые API | Браузерные и мобильные клиенты, где mTLS неудобен |
| Сложности | PKI, TLS termination на балансировщике | Генерация proof на каждый запрос, защита от replay (`jti`, `nonce`) |

Запрос с DPoP:

```http
GET /api/v1/orders HTTP/1.1
Host: api.example.com
Authorization: DPoP eyJhbGciOiJFUzI1NiIsImtpZCI6Ii...
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6IkVTMjU2IiwiandrIjp7...
```

DPoP proof содержит `htm` (метод), `htu` (URL), `iat`, `jti` и `ath` (хэш access token) и подписан ключом клиента, открытая часть которого — в заголовке proof (`jwk`).

### PAR — Pushed Authorization Requests {#par}

RFC 9126. Вместо передачи всех параметров авторизации через браузер (где их можно подменить и где они светятся в URL) клиент сначала отправляет их напрямую на AS и получает короткоживущую ссылку.

```mermaid
sequenceDiagram
    participant C as Клиент
    participant AS as Сервер авторизации
    participant U as Браузер пользователя
    C->>AS: POST par со всеми параметрами и аутентификацией клиента
    AS-->>C: 201 request_uri, expires_in 60
    C->>U: Редирект на authorize с client_id и request_uri
    U->>AS: GET authorize
    AS->>U: Вход, согласие, редирект с code
```

```http
POST /par HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic c2hvcC13ZWI6c2VjcmV0

response_type=code&client_id=shop-web&redirect_uri=https%3A%2F%2Fshop.example.com%2Fcallback
&scope=openid%20payments&state=af0ifjsldkj&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
&code_challenge_method=S256
```

```json
{"request_uri": "urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014ltc14eY22c", "expires_in": 60}
```

PAR обязателен в профилях высокой безопасности (FAPI 2.0 — финансовые API, open banking).

## OAuth 2.1 — что меняется {#oauth21}

OAuth 2.1 (черновик IETF, `draft-ietf-oauth-v2-1`) — не новый протокол, а консолидация OAuth 2.0 с накопленными лучшими практиками:

| Изменение | Было в OAuth 2.0 |
|---|---|
| PKCE обязателен для Authorization Code | Опционально, для публичных клиентов |
| Implicit grant удалён | Был стандартным для SPA |
| Resource Owner Password Credentials удалён | Был допустим |
| Redirect URI сравнивается точным совпадением строк | Допускались частичные совпадения и шаблоны |
| Bearer-токен нельзя передавать в query-строке | Разрешено RFC 6750 |
| Refresh token публичного клиента — с ротацией или sender-constrained | Не регламентировалось |

## Популярные серверы авторизации {#products}

| Продукт | Тип | Особенности для интеграций |
|---|---|---|
| **Keycloak** | Open source, on-premise | Realm, клиенты с Service Accounts для Client Credentials, поддержка mTLS, DPoP, PAR, Token Exchange; распространён в РФ |
| **Auth0** (Okta) | SaaS | Machine-to-Machine приложения, параметр `audience` при запросе токена |
| **Okta** | SaaS | Custom Authorization Servers, scopes и политики доступа на уровне сервера |
| **Microsoft Entra ID** (Azure AD) | SaaS | App registrations, scope вида `api://идентификатор/.default` для Client Credentials, App roles вместо scopes для приложений |

При интеграции с конкретным продуктом сверяйтесь с его документацией: названия параметров (`audience` или `resource`), формат scopes и claims различаются.

## Типичные ошибки {#mistakes}

| Ошибка | Последствие | Как правильно |
|---|---|---|
| Токены в `localStorage` браузера | Любой XSS крадёт токены | BFF с HttpOnly-cookie или токены только в памяти, короткий TTL |
| Не проверяется `state` | CSRF при входе, подсовывание чужой учётной записи | Генерировать случайный `state`, сверять при callback |
| Не проверяются `aud` и `iss` | Токен другого сервиса или другого AS принимается | Проверять оба на каждом RS |
| ID token используется для вызова API | Неверная аудитория, отсутствие scopes | Для API — только access token |
| Долгоживущие access token (сутки и больше) | Украденный токен долго работает, отзыв неэффективен | 5–15 минут для чувствительных API, плюс refresh или повторный Client Credentials |
| Новый токен на каждый запрос | Нагрузка на AS, лимиты, задержки | Кэш токена до истечения |
| Redirect URI с шаблонами | Перехват кода через открытый редирект | Точное совпадение, только HTTPS (кроме loopback для нативных приложений) |
| Client secret в мобильном приложении или SPA | Секрет извлекается из сборки | Публичный клиент + PKCE |
| Широкие scopes «на всякий случай» | Нарушение минимальных привилегий | Минимальный набор, отдельные клиенты под разные задачи |
| Токены и секреты в логах | Компрометация через систему логирования | Маскирование заголовка `Authorization` и тел token endpoint |

## Как описать OAuth 2.0 в постановке {#spec}

```yaml
authentication:
  type: OAuth 2.0
  grant_type: client_credentials
  issuer: https://auth.example.com/realms/partners
  discovery: https://auth.example.com/realms/partners/.well-known/openid-configuration
  token_endpoint: https://auth.example.com/realms/partners/protocol/openid-connect/token
  client_authentication: private_key_jwt   # или client_secret_basic, tls_client_auth
  client_id: partner-acme                   # выдаётся при регистрации
  scopes:
    - orders:read      # чтение заказов партнёра
    - orders:write     # создание и отмена заказов
  audience: orders-api
  access_token:
    format: JWT (RS256), проверка по jwks_uri
    lifetime: 300s
    caching: обязательно, обновление за 60s до истечения или при 401
  refresh_token: не выдаётся
  secrets_rotation: раз в 180 дней, перекрытие 14 дней, передача через портал
  environments:
    test: https://auth-test.example.com/realms/partners
    prod: https://auth.example.com/realms/partners
```

## На что обратить внимание аналитику {#analyst-checklist}

- [ ] Выбран грант под сценарий: Client Credentials для system-to-system, Authorization Code + PKCE для пользователей, Device — для устройств.
- [ ] Указаны `issuer`, адрес discovery и token endpoint для каждого окружения.
- [ ] Определён способ аутентификации клиента (лучше `private_key_jwt` или mTLS, чем секрет).
- [ ] Перечислены scopes с описанием, определена аудитория (`aud`) каждого API.
- [ ] Заданы сроки жизни access и refresh token, правила кэширования и обновления.
- [ ] Для refresh token включена ротация и описана реакция на `invalid_grant`.
- [ ] Ресурсный сервер проверяет подпись, `iss`, `aud`, `exp`, scopes (или использует introspection).
- [ ] Описаны отзыв токенов (revocation) и отключение клиента.
- [ ] Для пользовательских потоков: проверка `state`, `nonce`, точные redirect URI, PKCE `S256`.
- [ ] Implicit и Password grant не используются.
- [ ] Для повышенных требований рассмотрены mTLS-bound токены, DPoP, PAR.
- [ ] Описан процесс регистрации клиента, выдачи и ротации секретов или ключей.

## Стандарты и ссылки {#links}

- [RFC 6749 — The OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749)
- [RFC 6750 — Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 7636 — PKCE](https://www.rfc-editor.org/rfc/rfc7636)
- [RFC 9700 — Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700)
- [OAuth 2.1 (черновик IETF)](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/)
- [RFC 8628 — Device Authorization Grant](https://www.rfc-editor.org/rfc/rfc8628)
- [RFC 7662 — Token Introspection](https://www.rfc-editor.org/rfc/rfc7662)
- [RFC 7009 — Token Revocation](https://www.rfc-editor.org/rfc/rfc7009)
- [RFC 8693 — Token Exchange](https://www.rfc-editor.org/rfc/rfc8693)
- [RFC 8705 — Mutual-TLS Client Authentication and Certificate-Bound Access Tokens](https://www.rfc-editor.org/rfc/rfc8705)
- [RFC 9449 — DPoP](https://www.rfc-editor.org/rfc/rfc9449)
- [RFC 9126 — Pushed Authorization Requests](https://www.rfc-editor.org/rfc/rfc9126)
- [RFC 8414 — Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
- [RFC 7523 — JWT Profile for Client Authentication](https://www.rfc-editor.org/rfc/rfc7523)
- [RFC 9068 — JWT Profile for OAuth 2.0 Access Tokens](https://www.rfc-editor.org/rfc/rfc9068)
- [RFC 8707 — Resource Indicators](https://www.rfc-editor.org/rfc/rfc8707)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [OAuth 2.0 для браузерных приложений (черновик IETF)](https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/)
- [Документация Keycloak](https://www.keycloak.org/documentation)
