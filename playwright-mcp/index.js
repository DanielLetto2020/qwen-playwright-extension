#!/usr/bin/env node

/**
 * Playwright DevTools MCP Server v1.1.0
 * MCP сервер для управления браузером через Playwright
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { chromium } from 'playwright';

// Глобальное состояние
let browser = null;
let page = null;
let context = null;

/**
 * Инициализация браузера
 */
async function initBrowser(options = {}) {
  if (!browser) {
    const launchOptions = {
      headless: options.headless ?? false,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--enable-webgl2',
        '--start-maximized',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-blink-features=AutomationControlled',
      ]
    };
    browser = await chromium.launch(launchOptions);
  }

  if (!context) {
    context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'ru-RU',
      extraHTTPHeaders: { 'Accept-Language': 'ru-RU,ru;q=0.9' }
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  }

  if (!page) {
    page = await context.newPage();
  }

  return { browser, page };
}

/**
 * Получить snapshot страницы (с fallback)
 */
async function getPageSnapshot() {
  if (!page) {
    throw new Error('Browser not initialized. Call navigate first.');
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
  
  // Пробуем accessibility snapshot
  try {
    const snapshot = await page.accessibility.snapshot();
    if (snapshot) return snapshot;
  } catch (e) {
    // Игнорируем
  }
  
  // Fallback: генерируем snapshot из DOM
  return await page.evaluate(() => {
    function getElementTree(element, depth = 0) {
      if (depth > 3 || !element.children || element.children.length === 0) return null;
      const result = {
        role: element.tagName.toLowerCase(),
        name: element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent?.trim().substring(0, 50) || '',
        children: []
      };
      for (const child of element.children) {
        const childTree = getElementTree(child, depth + 1);
        if (childTree) result.children.push(childTree);
      }
      return result.children.length > 0 || result.name ? result : null;
    }
    return {
      role: 'document',
      name: document.title,
      children: Array.from(document.body.children).map(el => getElementTree(el)).filter(Boolean)
    };
  });
}

// Создание MCP сервера
const server = new McpServer({
  name: 'playwright-devtools',
  version: '1.1.0',
  description: 'MCP сервер для управления браузером через Playwright'
});

// === ИНСТРУМЕНТЫ ===

server.tool('navigate', 'Перейти на указанный URL', {
  url: z.string().url().describe('URL для навигации'),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']).optional().default('networkidle').describe('Когда считать загрузку завершенной'),
  timeout: z.number().optional().default(30000).describe('Таймаут в мс')
}, async ({ url, waitUntil, timeout }) => {
  try {
    await initBrowser();
    if (page) { await page.close(); page = null; }
    page = await context.newPage();
    const response = await page.goto(url, { waitUntil, timeout });
    return { content: [{ type: 'text', text: `✅ Навигация успешна\nURL: ${url}\nStatus: ${response?.status() || 'N/A'}\nTitle: ${await page.title()}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка навигации: ${error.message}` }], isError: true };
  }
});

server.tool('screenshot', 'Сделать скриншот страницы или элемента', {
  fullPage: z.boolean().optional().default(false).describe('Скриншот всей страницы'),
  selector: z.string().optional().describe('CSS селектор элемента для скриншота'),
  filePath: z.string().optional().describe('Путь для сохранения файла'),
  quality: z.number().min(1).max(100).optional().default(80).describe('Качество JPEG (1-100)')
}, async ({ fullPage, selector, filePath, quality }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const screenshotOptions = { type: 'png', fullPage };
    let screenshot = selector ? await (await page.$(selector))?.screenshot(screenshotOptions) : await page.screenshot(screenshotOptions);
    if (!screenshot) throw new Error('Element not found');
    const base64 = screenshot.toString('base64');
    const result = { content: [{ type: 'image', data: base64, mimeType: 'image/png' }, { type: 'text', text: `✅ Скриншот создан\nРазмер: ${screenshot.length} байт` }] };
    if (filePath) { await page.screenshot({ ...screenshotOptions, path: filePath }); }
    return result;
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка скриншота: ${error.message}` }], isError: true };
  }
});

server.tool('click', 'Кликнуть по элементу', {
  selector: z.string().describe('CSS селектор элемента'),
  button: z.enum(['left', 'right', 'middle']).optional().default('left').describe('Кнопка мыши'),
  clickCount: z.number().optional().default(1).describe('Количество кликов'),
  delay: z.number().optional().default(0).describe('Задержка между кликами (мс)')
}, async ({ selector, button, clickCount, delay }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    await page.click(selector, { button, clickCount, delay });
    return { content: [{ type: 'text', text: `✅ Клик выполнен\nСелектор: ${selector}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка клика: ${error.message}` }], isError: true };
  }
});

server.tool('type', 'Ввести текст в поле ввода', {
  selector: z.string().describe('CSS селектор элемента'),
  text: z.string().describe('Текст для ввода'),
  delay: z.number().optional().default(0).describe('Задержка между символами (мс)')
}, async ({ selector, text, delay }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    await page.fill(selector, text);
    return { content: [{ type: 'text', text: `✅ Текст введен\nСелектор: ${selector}\nТекст: ${text.substring(0, 50)}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка ввода: ${error.message}` }], isError: true };
  }
});

server.tool('press', 'Нажать клавишу', {
  key: z.string().describe('Клавиша (Enter, Tab, Escape, Control+A, etc.)'),
  selector: z.string().optional().describe('CSS селектор элемента (опционально)')
}, async ({ key, selector }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    selector ? await page.press(selector, key) : await page.keyboard.press(key);
    return { content: [{ type: 'text', text: `✅ Клавиша нажата\nКлавиша: ${key}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка нажатия: ${error.message}` }], isError: true };
  }
});

server.tool('snapshot', 'Получить accessibility snapshot страницы (структура DOM)', {}, async () => {
  try {
    const snapshot = await getPageSnapshot();
    return { content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка snapshot: ${error.message}` }], isError: true };
  }
});

server.tool('content', 'Получить HTML содержимое страницы', {
  selector: z.string().optional().describe('CSS селектор для получения innerHTML')
}, async ({ selector }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const content = selector ? await (await page.$(selector))?.innerHTML() : await page.content();
    return { content: [{ type: 'text', text: content || 'Element not found' }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка получения контента: ${error.message}` }], isError: true };
  }
});

server.tool('text', 'Получить видимый текст страницы', {}, async () => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const text = await page.evaluate(() => document.body.innerText);
    return { content: [{ type: 'text', text: text.substring(0, 5000) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка получения текста: ${error.message}` }], isError: true };
  }
});

server.tool('find', 'Найти элементы по селектору', {
  selector: z.string().describe('CSS селектор')
}, async ({ selector }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const elements = await page.$$(selector);
    const info = await Promise.all(elements.map(async (el, i) => ({
      index: i,
      text: (await el.textContent())?.trim().substring(0, 100) || '',
      visible: await el.isVisible()
    })));
    return { content: [{ type: 'text', text: `Найдено ${elements.length} элементов:\n\n` + info.map(el => `- [${el.index}] "${el.text}" (видимый: ${el.visible})`).join('\n') }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка поиска: ${error.message}` }], isError: true };
  }
});

server.tool('wait_for', 'Ждать появления текста на странице', {
  text: z.string().describe('Текст для ожидания'),
  timeout: z.number().optional().default(30000).describe('Таймаут в мс')
}, async ({ text, timeout }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    await page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout });
    return { content: [{ type: 'text', text: `✅ Текст найден: "${text}"` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Текст не найден: ${error.message}` }], isError: true };
  }
});

server.tool('info', 'Получить информацию о текущей странице (URL, title, viewport)', {}, async () => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const info = { url: page.url(), title: await page.title(), viewport: page.viewportSize() };
    return { content: [{ type: 'text', text: `📄 Информация о странице:\nURL: ${info.url}\nTitle: ${info.title}\nViewport: ${info.viewport?.width}x${info.viewport?.height}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка получения информации: ${error.message}` }], isError: true };
  }
});

server.tool('reload', 'Обновить текущую страницу', {
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']).optional().default('networkidle').describe('Когда считать загрузку завершенной')
}, async ({ waitUntil }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    await page.reload({ waitUntil });
    return { content: [{ type: 'text', text: `✅ Страница обновлена\nURL: ${page.url()}\nTitle: ${await page.title()}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка обновления: ${error.message}` }], isError: true };
  }
});

//=== ХРАНИЛИЩЕ И COOKIES ===

server.tool('get_cookies', 'Получить все cookies страницы', {}, async () => {
  try {
    if (!context) throw new Error('Browser not initialized');
    const cookies = await context.cookies();
    return { content: [{ type: 'text', text: `Cookies (${cookies.length}):\n${JSON.stringify(cookies, null, 2)}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('set_cookie', 'Установить cookie', {
  name: z.string().describe('Имя cookie'),
  value: z.string().describe('Значение cookie'),
  domain: z.string().optional().describe('Домен'),
  path: z.string().optional().default('/').describe('Путь'),
  expires: z.number().optional().describe('Unix timestamp истечения'),
  httpOnly: z.boolean().optional().default(false),
  secure: z.boolean().optional().default(false),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional().default('Lax')
}, async (cookie) => {
  try {
    if (!context) throw new Error('Browser not initialized');
    await context.addCookies([cookie]);
    return { content: [{ type: 'text', text: `✅ Cookie установлен: ${cookie.name}=${cookie.value}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('clear_cookies', 'Очистить все cookies', {}, async () => {
  try {
    if (!context) throw new Error('Browser not initialized');
    await context.clearCookies();
    return { content: [{ type: 'text', text: '✅ Cookies очищены' }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('local_storage_get', 'Получить значение из localStorage', {
  key: z.string().describe('Ключ')
}, async ({ key }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const value = await page.evaluate(k => localStorage.getItem(k), key);
    return { content: [{ type: 'text', text: `localStorage["${key}"] = ${value}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('local_storage_set', 'Записать значение в localStorage', {
  key: z.string().describe('Ключ'),
  value: z.string().describe('Значение')
}, async ({ key, value }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: key, v: value });
    return { content: [{ type: 'text', text: `✅ localStorage["${key}"] = "${value}"` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('session_storage_get', 'Получить значение из sessionStorage', {
  key: z.string().describe('Ключ')
}, async ({ key }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const value = await page.evaluate(k => sessionStorage.getItem(k), key);
    return { content: [{ type: 'text', text: `sessionStorage["${key}"] = ${value}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

//=== ФАЙЛЫ ===

server.tool('upload_file', 'Загрузить файл через file input', {
  selector: z.string().describe('CSS селектор input[type=file]'),
  filePath: z.string().describe('Абсолютный путь к файлу')
}, async ({ selector, filePath }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const input = await page.locator(selector);
    await input.setInputFiles(filePath);
    return { content: [{ type: 'text', text: `✅ Файл загружен: ${filePath}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('download_file', 'Скачать файл по ссылке', {
  selector: z.string().optional().describe('CSS селектор ссылки (опционально)'),
  url: z.string().optional().describe('URL файла (опционально)'),
  filePath: z.string().describe('Путь для сохранения')
}, async ({ selector, url, filePath }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      selector ? page.click(selector) : page.evaluate(u => { location.href = u; }, url)
    ]);
    await download.saveAs(filePath);
    return { content: [{ type: 'text', text: `✅ Файл скачан: ${filePath}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

//=== DOM ВЗАИМОДЕЙСТВИЕ ===

server.tool('drag_and_drop', 'Drag and drop элемента', {
  sourceSelector: z.string().describe('Селектор элемента-источника'),
  targetSelector: z.string().describe('Селектор целевого элемента')
}, async ({ sourceSelector, targetSelector }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    await page.dragAndDrop(sourceSelector, targetSelector);
    return { content: [{ type: 'text', text: `✅ Drag & drop выполнен` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('scroll_to', 'Прокрутка к элементу или координатам', {
  selector: z.string().optional().describe('CSS селектор (опционально)'),
  x: z.number().optional().describe('Координата X'),
  y: z.number().optional().describe('Координата Y')
}, async ({ selector, x, y }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    if (selector) {
      await page.locator(selector).scrollIntoViewIfNeeded();
    } else {
      await page.evaluate(({ cx, cy }) => window.scrollTo(cx, cy), { cx: x || 0, cy: y || 0 });
    }
    return { content: [{ type: 'text', text: `✅ Прокрутка выполнена` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('hover', 'Навести курсор на элемент', {
  selector: z.string().describe('CSS селектор')
}, async ({ selector }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    await page.hover(selector);
    return { content: [{ type: 'text', text: `✅ Hover выполнен: ${selector}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('focus', 'Фокусировка на элементе', {
  selector: z.string().describe('CSS селектор')
}, async ({ selector }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    await page.focus(selector);
    return { content: [{ type: 'text', text: `✅ Фокус установлен: ${selector}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('select_option', 'Выбрать опцию в select', {
  selector: z.string().describe('CSS селектор select'),
  value: z.string().describe('Значение option')
}, async ({ selector, value }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    await page.selectOption(selector, value);
    return { content: [{ type: 'text', text: `✅ Выбрано: ${value}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('check_checkbox', 'Установить/снять чекбокс', {
  selector: z.string().describe('CSS селектор'),
  checked: z.boolean().describe('Состояние: true/false')
}, async ({ selector, checked }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    checked ? await page.check(selector) : await page.uncheck(selector);
    return { content: [{ type: 'text', text: `✅ Чекбокс ${checked ? 'отмечен' : 'снят'}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('get_element_attribute', 'Получить атрибут элемента', {
  selector: z.string().describe('CSS селектор'),
  attribute: z.string().describe('Имя атрибута')
}, async ({ selector, attribute }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const el = await page.locator(selector).first();
    const value = await el.getAttribute(attribute);
    return { content: [{ type: 'text', text: `${attribute}="${value}"` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('get_element_styles', 'Получить CSS-стили элемента', {
  selector: z.string().describe('CSS селектор'),
  property: z.string().optional().describe('Конкретное свойство CSS (опционально)')
}, async ({ selector, property }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const styles = await page.evaluate(({ sel, prop }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const computed = getComputedStyle(el);
      return prop ? { [prop]: computed[prop] } : Object.fromEntries(Array.from(computed).map(k => [k, computed[k]]));
    }, { sel: selector, prop: property });
    return { content: [{ type: 'text', text: JSON.stringify(styles, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

//=== JAVASCRIPT И ПРОИЗВОДИТЕЛЬНОСТЬ ===

server.tool('execute_script', 'Выполнить JavaScript на странице', {
  script: z.string().describe('JavaScript код')
}, async ({ script }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const result = await page.evaluate(({ s }) => { try { return eval(s); } catch(e) { return e.message; } }, { s: script });
    return { content: [{ type: 'text', text: `Result: ${JSON.stringify(result)}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('console_logs', 'Получить логи консоли браузера', {
  level: z.enum(['log', 'warn', 'error', 'info', 'debug', 'all']).optional().default('all').describe('Фильтр по уровню')
}, async ({ level }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const logs = [];
    page.on('console', msg => {
      if (level === 'all' || msg.type() === level) {
        logs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    await page.waitForTimeout(100);
    return { content: [{ type: 'text', text: logs.join('\n') || 'No logs captured' }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('performance_metrics', 'Получить метрики производительности', {}, async () => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const metrics = await page.evaluate(() => {
      const perf = performance;
      const nav = perf.getEntriesByType('navigation')[0];
      return {
        url: location.href,
        loadTime: nav ? nav.loadEventEnd - nav.startTime : perf.timing.loadEventEnd - perf.timing.navigationStart,
        domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : null,
        ttfb: nav ? nav.responseStart - nav.startTime : null,
        memory: performance.memory ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        } : 'N/A'
      };
    });
    return { content: [{ type: 'text', text: JSON.stringify(metrics, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('get_network_requests', 'Получить сетевые запросы (fetch + XHR)', {
  urlPattern: z.string().optional().describe('Фильтр по URL (substring)'),
  resourceType: z.enum(['xhr', 'fetch', 'script', 'stylesheet', 'image', 'document', 'all']).optional().default('all')
}, async ({ urlPattern, resourceType }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const requests = [];
    page.on('request', req => {
      const matchesUrl = !urlPattern || req.url().includes(urlPattern);
      const matchesType = resourceType === 'all' || req.resourceType() === resourceType;
      if (matchesUrl && matchesType) {
        requests.push({
          url: req.url().substring(0, 100),
          method: req.method(),
          type: req.resourceType()
        });
      }
    });
    await page.waitForTimeout(500);
    return { content: [{ type: 'text', text: `Requests (${requests.length}):\n${JSON.stringify(requests, null, 2)}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

//=== КОНТЕКСТ И ОКНА ===

server.tool('switch_to_frame', 'Переключиться во фрейм (iframe)', {
  selector: z.string().describe('CSS селектор iframe')
}, async ({ selector }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    const frame = page.locator(selector).contentFrame();
    if (!frame) throw new Error('Frame not found');
    await frame.waitForLoadState('domcontentloaded');
    page.__currentFrame = frame;
    return { content: [{ type: 'text', text: `✅ Переключено во фрейм: ${selector}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('switch_to_main', 'Вернуться к основному документу', {}, async () => {
  try {
    if (!page) throw new Error('Browser not initialized');
    page.__currentFrame = null;
    return { content: [{ type: 'text', text: '✅ Переключено к основному документу' }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('open_new_tab', 'Открыть новую вкладку', {
  url: z.string().describe('URL для открытия')
}, async ({ url }) => {
  try {
    if (!context) throw new Error('Browser not initialized');
    const newPage = await context.newPage();
    await newPage.goto(url);
    return { content: [{ type: 'text', text: `✅ Новая вкладка открыта: ${url}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('switch_to_tab', 'Переключиться на вкладку по индексу', {
  index: z.number().describe('Индекс вкладки (0-based)')
}, async ({ index }) => {
  try {
    if (!context) throw new Error('Browser not initialized');
    const pages = context.pages();
    if (index >= pages.length) throw new Error(`Invalid tab index: ${index}`);
    page = pages[index];
    await page.bringToFront();
    return { content: [{ type: 'text', text: `✅ Переключено на вкладку ${index}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('close_tab', 'Закрыть текущую вкладку', {}, async () => {
  try {
    if (!page) throw new Error('Browser not initialized');
    await page.close();
    const pages = context.pages();
    page = pages[pages.length - 1] || null;
    return { content: [{ type: 'text', text: '✅ Вкладка закрыта' }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('handle_dialog', 'Обработать диалог (alert/confirm/prompt)', {
  action: z.enum(['accept', 'dismiss']).describe('Действие'),
  promptText: z.string().optional().describe('Текст для prompt (если применимо)')
}, async ({ action, promptText }) => {
  try {
    if (!page) throw new Error('Browser not initialized');
    page.once('dialog', async dialog => {
      if (action === 'accept') {
        await dialog.accept(promptText);
      } else {
        await dialog.dismiss();
      }
    });
    return { content: [{ type: 'text', text: `✅ Диалог будет ${action === 'accept' ? 'принят' : 'отклонен'}` }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }], isError: true };
  }
});

server.tool('close', 'Закрыть браузер и очистить ресурсы', {}, async () => {
  try {
    if (page) { await page.close(); page = null; }
    if (context) { await context.close(); context = null; }
    if (browser) { await browser.close(); browser = null; }
    return { content: [{ type: 'text', text: '✅ Браузер закрыт' }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `❌ Ошибка закрытия: ${error.message}` }], isError: true };
  }
});

// Запуск сервера
const transport = new StdioServerTransport();
server.connect(transport);
console.log('✅ Playwright DevTools MCP Server запущен (v1.1.0)');
