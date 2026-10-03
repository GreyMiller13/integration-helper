import { defineConfig, type DefaultTheme, type MarkdownRenderer } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// Чек-листы: пункты списка вида «- [ ] текст» / «- [x] текст» превращаются в флажки
function taskLists(md: MarkdownRenderer) {
  md.core.ruler.push('task_lists', (state) => {
    const tokens = state.tokens
    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i]
      if (inline.type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue
      const first = inline.children?.[0]
      const match = first?.type === 'text' ? /^\[([ xX])\]\s+/.exec(first.content) : null
      if (!first || !match) continue
      first.content = first.content.slice(match[0].length)
      const checkbox = new state.Token('html_inline', '', 0)
      checkbox.content = `<input type="checkbox" class="task-list-item-checkbox"${match[1] === ' ' ? '' : ' checked'}>`
      inline.children!.unshift(checkbox)
      tokens[i - 2].attrJoin('class', 'task-list-item')
    }
  })
}

// Боковое меню. Чтобы добавить страницу: создайте .md-файл и пропишите его здесь.
const sidebar: DefaultTheme.Sidebar = [
  {
    text: 'Введение',
    collapsed: false,
    items: [
      { text: 'О справочнике', link: '/guide/' },
      { text: 'Чек-лист интеграции', link: '/guide/integration-checklist' },
      { text: 'Глоссарий', link: '/guide/glossary' },
    ],
  },
  {
    text: 'Протоколы и технологии',
    collapsed: false,
    items: [
      { text: 'Обзор и выбор технологии', link: '/protocols/' },
      { text: 'REST', link: '/protocols/rest' },
      { text: 'SOAP', link: '/protocols/soap' },
      { text: 'GraphQL', link: '/protocols/graphql' },
      { text: 'gRPC', link: '/protocols/grpc' },
      { text: 'JSON-RPC', link: '/protocols/json-rpc' },
      { text: 'OData', link: '/protocols/odata' },
      { text: 'WebSocket', link: '/protocols/websocket' },
      { text: 'SSE и Long Polling', link: '/protocols/sse' },
      { text: 'Webhooks', link: '/protocols/webhooks' },
      { text: 'Брокеры сообщений', link: '/protocols/messaging' },
      { text: 'Файловый обмен', link: '/protocols/file-exchange' },
      { text: 'Форматы данных', link: '/protocols/data-formats' },
    ],
  },
  {
    text: 'HTTP',
    collapsed: false,
    items: [
      { text: 'Основы HTTP', link: '/http/basics' },
      { text: 'Методы', link: '/http/methods' },
      { text: 'Коды состояния', link: '/http/status-codes' },
      { text: 'Заголовки', link: '/http/headers' },
      { text: 'Медиатипы и согласование', link: '/http/content-negotiation' },
    ],
  },
  {
    text: 'Проектирование REST API',
    collapsed: false,
    items: [
      { text: 'Ресурсы и URI', link: '/design/' },
      { text: 'Идемпотентность', link: '/design/idempotency' },
      { text: 'Пагинация', link: '/design/pagination' },
      { text: 'Фильтрация и сортировка', link: '/design/filtering' },
      { text: 'Кэширование', link: '/design/caching' },
      { text: 'Конкурентный доступ', link: '/design/concurrency' },
      { text: 'Ошибки', link: '/design/errors' },
      { text: 'Версионирование', link: '/design/versioning' },
      { text: 'Rate limiting', link: '/design/rate-limiting' },
      { text: 'Асинхронные операции', link: '/design/async-operations' },
      { text: 'Пакетные операции', link: '/design/bulk' },
      { text: 'Соглашения о данных', link: '/design/data-conventions' },
    ],
  },
  {
    text: 'Безопасность',
    collapsed: false,
    items: [
      { text: 'Обзор', link: '/security/' },
      { text: 'Аутентификация', link: '/security/authentication' },
      { text: 'OAuth 2.0 и OpenID Connect', link: '/security/oauth2' },
      { text: 'JWT', link: '/security/jwt' },
      { text: 'TLS и mTLS', link: '/security/tls' },
      { text: 'CORS', link: '/security/cors' },
      { text: 'OWASP API Top 10', link: '/security/owasp-api' },
      { text: 'Чек-лист безопасности', link: '/security/best-practices' },
    ],
  },
  {
    text: 'Надёжность и паттерны',
    collapsed: false,
    items: [
      { text: 'Таймауты и повторы', link: '/reliability/timeouts-retries' },
      { text: 'Паттерны устойчивости', link: '/reliability/resilience-patterns' },
      { text: 'Интеграционные паттерны', link: '/reliability/integration-patterns' },
      { text: 'Наблюдаемость', link: '/reliability/observability' },
    ],
  },
  {
    text: 'Спецификации',
    collapsed: false,
    items: [
      { text: 'OpenAPI', link: '/specs/openapi' },
      { text: 'AsyncAPI', link: '/specs/asyncapi' },
      { text: 'Шаблон описания интеграции', link: '/specs/integration-template' },
    ],
  },
  {
    text: 'Инструменты',
    collapsed: false,
    items: [
      { text: 'Обзор инструментов', link: '/tools/' },
      { text: 'Шпаргалка curl', link: '/tools/curl' },
      { text: 'Тестирование API', link: '/tools/testing' },
    ],
  },
]

export default withMermaid(
  defineConfig({
    lang: 'ru-RU',
    title: 'Integration Helper',
    description: 'Справочник системного аналитика по интеграциям: протоколы, HTTP, REST API, безопасность, надёжность',
    // Для публикации на GitHub/GitLab Pages в подпапке задайте base через переменную окружения, например BASE=/repo-name/
    base: process.env.BASE || '/',
    cleanUrls: true,
    lastUpdated: true,
    head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${process.env.BASE || '/'}logo.svg` }]],

    markdown: {
      lineNumbers: false,
      config: (md) => md.use(taskLists),
      container: {
        tipLabel: 'Совет',
        warningLabel: 'Внимание',
        dangerLabel: 'Опасно',
        infoLabel: 'Информация',
        detailsLabel: 'Подробнее',
      },
    },

    themeConfig: {
      logo: '/logo.svg',
      nav: [
        { text: 'Главная', link: '/' },
        { text: 'Протоколы', link: '/protocols/', activeMatch: '/protocols/' },
        { text: 'HTTP', link: '/http/basics', activeMatch: '/http/' },
        { text: 'REST API', link: '/design/', activeMatch: '/design/' },
        { text: 'Безопасность', link: '/security/', activeMatch: '/security/' },
        { text: 'API-тестер', link: '/tester/', activeMatch: '/tester/' },
      ],
      sidebar,
      outline: { level: [2, 3], label: 'На этой странице' },
      search: {
        provider: 'local',
        options: {
          translations: {
            button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск' },
            modal: {
              displayDetails: 'Показать подробности',
              resetButtonTitle: 'Сбросить поиск',
              backButtonTitle: 'Закрыть поиск',
              noResultsText: 'Ничего не найдено по запросу',
              footer: {
                selectText: 'выбрать',
                navigateText: 'перейти',
                closeText: 'закрыть',
              },
            },
          },
        },
      },
      docFooter: { prev: 'Предыдущая', next: 'Следующая' },
      lastUpdated: { text: 'Обновлено' },
      darkModeSwitchLabel: 'Тема',
      lightModeSwitchTitle: 'Светлая тема',
      darkModeSwitchTitle: 'Тёмная тема',
      sidebarMenuLabel: 'Меню',
      returnToTopLabel: 'Наверх',
      langMenuLabel: 'Язык',
      notFound: {
        title: 'СТРАНИЦА НЕ НАЙДЕНА',
        quote: '404 Not Found — сервер не нашёл ресурс по этому URI.',
        linkText: 'На главную',
      },
      footer: {
        message: 'Справочник по интеграциям для системных аналитиков',
      },
    },

    vite: {
      // Mermaid — тяжёлая библиотека, большой чанк здесь ожидаем
      build: { chunkSizeWarningLimit: 4000 },
      // Без предварительной сборки mermaid в dev-режиме его CommonJS-зависимости (fastdom)
      // попадают в браузер как есть, и страница остаётся белой
      optimizeDeps: { include: ['mermaid'] },
    },

    mermaid: {},
  }),
)
