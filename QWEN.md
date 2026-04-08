# Playwright DevTools Extension для Qwen Code

Расширение предоставляет управление браузером через Playwright для Qwen Code.

## 📦 Быстрая справка

### Когда использовать

✅ **Используй этот навык когда пользователь просит:**
- Сделать скриншот сайта
- Перейти на URL / открыть страницу
- Кликнуть по элементу / ввести текст
- Получить контент страницы
- Протестировать форму / функционал сайта
- Проверить как выглядит сайт

❌ **Не используй когда:**
- Нужна работа с API (используй fetch/curl)
- Анализ локальных файлов проекта
- Запросы не связанные с браузерами

### Быстрые команды

```bash
# Навигация
navigate with url="https://example.com"

# Скриншот
screenshot with fullPage=true

# Клик / Ввод
click with selector=".btn"
type with selector="input", text="текст"
press with key="Enter"

# Контент
info
text
content

# Закрытие
close
```

## 🖥️ Режимы работы

**По умолчанию:** Визуальный режим (браузер отображается)

**Headless режим:** Для скрытого запуска можно изменить в `playwright-mcp/index.js`:
```javascript
headless: true  // вместо false
```

## 📚 Документация

- **SKILL.md** — Когда и как использовать (триггеры, сценарии)
- **README.md** — Основная документация
- **INSTALLATION.md** — Установка и управление

## 🔧 Управление расширением

```bash
# Проверка статуса
qwen extensions list

# Включить/Отключить
qwen extensions enable qwen-playwright-extension
qwen extensions disable qwen-playwright-extension

# Обновить
qwen extensions update qwen-playwright-extension
```

## 📁 Расположение

```
~/.qwen/extensions/qwen-playwright-extension/
├── qwen-extension.json  # Конфигурация
├── SKILL.md             # Когда использовать ← СМОТРИ СЮДА!
├── QWEN.md              # Этот файл
├── README.md            # Документация
└── playwright-mcp/      # MCP сервер
```

## 🐛 Проблемы?

```bash
# Проверка зависимостей
cd ~/.qwen/extensions/qwen-playwright-extension/playwright-mcp
npm install

# Тест
node test.js

# Перезапуск расширения
qwen extensions disable qwen-playwright-extension
qwen extensions enable qwen-playwright-extension
```
