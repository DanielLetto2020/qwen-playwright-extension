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
