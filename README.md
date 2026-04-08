# Qwen Playwright Extension

[![Version](https://img.shields.io/badge/version-1.2.0-blue)](https://github.com/DanielLetto2020/qwen-playwright-extension)
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
| `hover` | Наведение курсора | `mcp__playwright-devtools__hover with selector=".menu"` |
| `focus` | Фокусировка | `mcp__playwright-devtools__focus with selector="input"` |
| `scroll_to` | Прокрутка | `mcp__playwright-devtools__scroll_to with selector="#section"` |
| `drag_and_drop` | Drag & drop | `mcp__playwright-devtools__drag_and_drop with sourceSelector=".item", targetSelector=".dropzone"` |
| `select_option` | Выбор в select | `mcp__playwright-devtools__select_option with selector="select", value="option1"` |
| `check_checkbox` | Чекбокс | `mcp__playwright-devtools__check_checkbox with selector="input", checked=true` |
| `get_element_attribute` | Атрибут | `mcp__playwright-devtools__get_element_attribute with selector="a", attribute="href"` |
| `get_element_styles` | CSS стили | `mcp__playwright-devtools__get_element_styles with selector=".box"` |

### Скриншоты

| Инструмент | Описание | Пример |
|------------|----------|--------|
| `screenshot` | Скриншот страницы | `mcp__playwright-devtools__screenshot with fullPage=true` |
| `screenshot` | Элемента | `mcp__playwright-devtools__screenshot with selector="h1"` |

### Cookies и хранилище

| Инструмент | Описание | Пример |
|------------|----------|--------|
| `get_cookies` | Получить cookies | `mcp__playwright-devtools__get_cookies` |
| `set_cookie` | Установить cookie | `mcp__playwright-devtools__set_cookie with name="token", value="abc123"` |
| `clear_cookies` | Очистить cookies | `mcp__playwright-devtools__clear_cookies` |
| `local_storage_get` | Чтение localStorage | `mcp__playwright-devtools__local_storage_get with key="user"` |
| `local_storage_set` | Запись localStorage | `mcp__playwright-devtools__local_storage_set with key="user", value="admin"` |
| `session_storage_get` | Чтение sessionStorage | `mcp__playwright-devtools__session_storage_get with key="session"` |

### Файлы

| Инструмент | Описание | Пример |
|------------|----------|--------|
| `upload_file` | Загрузка файла | `mcp__playwright-devtools__upload_file with selector="input[type=file]", filePath="/path/to/file.jpg"` |
| `download_file` | Скачивание | `mcp__playwright-devtools__download_file with selector=".download", filePath="/tmp/file.pdf"` |

### JavaScript и производительность

| Инструмент | Описание | Пример |
|------------|----------|--------|
| `execute_script` | Выполнить JS | `mcp__playwright-devtools__execute_script with script="return document.title"` |
| `console_logs` | Логи консоли | `mcp__playwright-devtools__console_logs with level="error"` |
| `performance_metrics` | Метрики | `mcp__playwright-devtools__performance_metrics` |
| `get_network_requests` | Сетевые запросы | `mcp__playwright-devtools__get_network_requests with resourceType="xhr"` |

### Вкладки и фреймы

| Инструмент | Описание | Пример |
|------------|----------|--------|
| `open_new_tab` | Новая вкладка | `mcp__playwright-devtools__open_new_tab with url="https://google.com"` |
| `switch_to_tab` | Переключить вкладку | `mcp__playwright-devtools__switch_to_tab with index=1` |
| `close_tab` | Закрыть вкладку | `mcp__playwright-devtools__close_tab` |
| `switch_to_frame` | Во фрейм | `mcp__playwright-devtools__switch_to_frame with selector="iframe"` |
| `switch_to_main` | К основному документу | `mcp__playwright-devtools__switch_to_main` |
| `handle_dialog` | Обработать диалог | `mcp__playwright-devtools__handle_dialog with action="accept"` |

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

### Проверка cookies и localStorage

```
mcp__playwright-devtools__navigate with url="https://example.com"
mcp__playwright-devtools__set_cookie with name="auth", value="token123"
mcp__playwright-devtools__local_storage_set with key="user_id", value="42"
mcp__playwright-devtools__get_cookies
mcp__playwright-devtools__local_storage_get with key="user_id"
```

### Перехват сетевых запросов

```
mcp__playwright-devtools__navigate with url="https://example.com"
mcp__playwright-devtools__get_network_requests with resourceType="xhr", urlPattern="/api"
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
