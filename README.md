# Qwen Playwright Extension

[![Version](https://img.shields.io/badge/version-1.1.0-blue)](https://github.com/DanielLetto2020/qwen-playwright-extension)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Расширение для [Qwen Code](https://github.com/QwenLM/qwen-code), предоставляющее управление браузером через [Playwright](https://playwright.dev/).

## Установка

```bash
qwen extensions install DanielLetto2020/qwen-playwright-extension
```

После установки необходимо установить браузеры Playwright:

```bash
cd ~/.qwen/extensions/qwen-playwright-extension/playwright-mcp
npx playwright install chromium
```

## Инструменты

Все инструменты доступны через префикс `mcp__playwright-devtools__`.

### Навигация и управление страницей

| Инструмент | Описание | Пример |
|------------|----------|--------|
| `navigate` | Переход на URL | `mcp__playwright-devtools__navigate with url="https://example.com"` |
| `reload` | Перезагрузка страницы | `mcp__playwright-devtools__reload` |
| `info` | Информация о странице | `mcp__playwright-devtools__info` |
| `close` | Закрытие браузера | `mcp__playwright-devtools__close` |

### Получение контента

| Инструмент | Описание | Пример |
|------------|----------|--------|
| `text` | Видимый текст страницы | `mcp__playwright-devtools__text` |
| `content` | HTML содержимое | `mcp__playwright-devtools__content` |
| `snapshot` | Accessibility snapshot | `mcp__playwright-devtools__snapshot` |

### Взаимодействие с элементами

| Инструмент | Описание | Пример |
|------------|----------|--------|
| `click` | Клик по элементу | `mcp__playwright-devtools__click with selector=".btn"` |
| `type` | Ввод текста | `mcp__playwright-devtools__type with selector="input", text="value"` |
| `press` | Нажатие клавиши | `mcp__playwright-devtools__press with key="Enter"` |
| `find` | Поиск элементов | `mcp__playwright-devtools__find with selector="a"` |
| `wait_for` | Ожидание текста | `mcp__playwright-devtools__wait_for with text="Загрузка завершена"` |

### Скриншоты

| Инструмент | Описание | Пример |
|------------|----------|--------|
| `screenshot` | Скриншот страницы | `mcp__playwright-devtools__screenshot with fullPage=true` |
| `screenshot` | Элемента по селектору | `mcp__playwright-devtools__screenshot with selector="h1"` |

## Примеры использования

### Базовый сценарий

```
mcp__playwright-devtools__navigate with url="https://example.com"
mcp__playwright-devtools__screenshot with fullPage=true
mcp__playwright-devtools__close
```

### Работа с формой

```
mcp__playwright-devtools__navigate with url="https://example.com/login"
mcp__playwright-devtools__type with selector="input[name=email]", text="user@example.com"
mcp__playwright-devtools__type with selector="input[name=password]", text="password123"
mcp__playwright-devtools__click with selector="button[type=submit]"
mcp__playwright-devtools__wait_for with text="Welcome"
mcp__playwright-devtools__screenshot
mcp__playwright-devtools__close
```

## Требования

- Qwen Code
- Node.js 18+
- Playwright с установленным Chromium

## Режим работы

По умолчанию браузер запускается в визуальном режиме (окно браузера видно). Для headless-режима измените `headless: true` в `playwright-mcp/index.js`.

## Локальная разработка

```bash
git clone https://github.com/DanielLetto2020/qwen-playwright-extension.git
cd qwen-playwright-extension
qwen extensions link .
```

## Лицензия

[MIT](LICENSE)
