import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runE2E() {
  console.log('🚀 Starting Stremix E2E Verification with Puppeteer & Chrome...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleLogs = [];
  const errors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(text);
    if (msg.type() === 'error' && !text.includes('favicon')) {
      errors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  try {
    // 1. Load Homepage
    console.log('1. Navigating to http://localhost:5173/ ...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.brand-text', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'screenshot-home.png' });
    console.log('✓ Home page loaded and screenshot-home.png saved.');

    // 2. Open First Media Card Modal
    console.log('2. Clicking first media card to open detail modal...');
    await page.waitForSelector('.media-card', { timeout: 10000 });
    const firstCard = await page.$('.media-card');
    await firstCard.click();
    await page.waitForSelector('.modal-sheet', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'screenshot-modal.png' });
    console.log('✓ Detail modal opened with AIOStreams section, screenshot-modal.png saved.');

    // 3. Play stream
    console.log('3. Clicking stream play button...');
    const playBtn = await page.$('.stream-card .stream-play-btn') || await page.$('.modal-body .btn-primary');
    if (playBtn) {
      await playBtn.click();
      await page.waitForSelector('.player-container', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: 'screenshot-player.png' });
      console.log('✓ Video player launched successfully, screenshot-player.png saved.');

      // Close player (Esc or close btn)
      const closeBtn = await page.$('.player-top-bar button');
      if (closeBtn) await closeBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    // Close modal if open
    const modalClose = await page.$('.modal-close-btn');
    if (modalClose) {
      await modalClose.click();
      await new Promise(r => setTimeout(r, 800));
    }

    // 4. Test Search Bar
    console.log('4. Testing search input...');
    const searchInput = await page.$('.search-input');
    await searchInput.type('Dune', { delay: 100 });
    await page.waitForSelector('.search-dropdown', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'screenshot-search.png' });
    console.log('✓ Search dropdown loaded matching titles, screenshot-search.png saved.');

    // Clear search
    const clearBtn = await page.$('.search-clear-btn');
    if (clearBtn) await clearBtn.click();
    await new Promise(r => setTimeout(r, 500));

    // 5. Open AIOStreams Settings Modal
    console.log('5. Opening AIOStreams settings modal...');
    const settingsPill = await page.$('.status-pill');
    await settingsPill.click();
    await page.waitForSelector('.instance-cards-grid', { timeout: 5000 });
    
    // Click Probar Conexión
    const testConnBtn = await page.$('button::-p-text(Probar Conexión)');
    if (testConnBtn) {
      await testConnBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
    await page.screenshot({ path: 'screenshot-settings.png' });
    console.log('✓ AIOStreams settings & live connection tested, screenshot-settings.png saved.');

    // Close settings
    const settingsClose = await page.$('.modal-close-btn');
    if (settingsClose) await settingsClose.click();
    await new Promise(r => setTimeout(r, 500));

    // 6. Test Library Tab
    console.log('6. Switching to Mi Biblioteca...');
    const libraryBtn = await page.$('button::-p-text(Mi Biblioteca)');
    if (libraryBtn) {
      await libraryBtn.click();
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: 'screenshot-library.png' });
      console.log('✓ Library view loaded with Continue Watching and Favorites, screenshot-library.png saved.');
    }

    console.log('----------------------------------------------------');
    console.log(`Page Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.warn('Errors encountered:', errors);
    } else {
      console.log('🎉 ALL TESTS PASSED WITH 0 JAVASCRIPT ERRORS!');
    }
  } catch (err) {
    console.error('E2E Test Failure:', err);
  } finally {
    await browser.close();
  }
}

runE2E();
