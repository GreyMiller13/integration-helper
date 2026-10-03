---
layout: home

hero:
  name: Integration Helper
  text: Справочник по интеграциям
  tagline: Протоколы, HTTP, проектирование REST API, безопасность и надёжность — всё, что нужно системному аналитику, в одном месте
  image:
    src: /logo.svg
    alt: Integration Helper
  actions:
    - theme: brand
      text: Выбрать технологию
      link: /protocols/
    - theme: alt
      text: Коды состояния
      link: /http/status-codes
    - theme: alt
      text: Чек-лист интеграции
      link: /guide/integration-checklist

features:
  - icon: 🔌
    title: Протоколы и технологии
    details: REST, SOAP, GraphQL, gRPC, JSON-RPC, OData, WebSocket, SSE, Webhooks, брокеры сообщений, файловый обмен. Сравнение и выбор под задачу.
    link: /protocols/
    linkText: К сравнению
  - icon: 🌐
    title: HTTP
    details: Структура запросов, методы и их свойства, все коды состояния, заголовки, медиатипы и согласование содержимого.
    link: /http/basics
    linkText: Основы HTTP
  - icon: 🧩
    title: Проектирование REST API
    details: Ресурсы и URI, идемпотентность, пагинация, фильтрация, кэширование, ошибки, версионирование, rate limiting, асинхронные операции.
    link: /design/
    linkText: Принципы
  - icon: 🔐
    title: Безопасность
    details: Аутентификация, OAuth 2.0 и OpenID Connect, JWT, TLS и mTLS, CORS, OWASP API Top 10 и чек-лист безопасности.
    link: /security/
    linkText: Обзор
  - icon: 🛡️
    title: Надёжность и паттерны
    details: Таймауты, повторы, circuit breaker, outbox, saga, idempotent consumer, наблюдаемость и SLO.
    link: /reliability/timeouts-retries
    linkText: Подробнее
  - icon: 📝
    title: Спецификации и шаблоны
    details: OpenAPI, AsyncAPI и готовый шаблон описания интеграции для постановки задачи.
    link: /specs/integration-template
    linkText: Шаблон
  - icon: 🧰
    title: Инструменты
    details: Postman, Bruno, curl, моки, перехват трафика, тестирование API — что использовать и как.
    link: /tools/
    linkText: Обзор
  - icon: 🧪
    title: API-тестер
    details: Отправка запросов и проверка ответов прямо со страницы справочника. В разработке.
    link: /tester/
    linkText: Что планируется
---
