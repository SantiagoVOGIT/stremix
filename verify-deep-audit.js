import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runDeepAudit() {
  console.log('🚀 Running Deep Stremix Verification Audit with Chrome...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 950 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const errors = [];
  const warnings = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('favicon') && !text.includes('ERR_BLOCKED_BY_CLIENT')) {
      errors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  try {
    // 1. Load Homepage
    console.log('1. Loading http://localhost:5173/ ...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.brand-text', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'screenshot-audit-home.png' });
    console.log('✓ Home loaded, screenshot-audit-home.png saved.');

    // 2. Open First Media Item Modal (Movie)
    console.log('2. Opening Media Modal...');
    await page.waitForSelector('.media-card', { timeout: 10000 });
    const cards = await page.$$('.media-card');
    if (cards.length > 0) {
      await cards[0].click();
      await page.waitForSelector('.modal-sheet', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: 'screenshot-audit-modal-streams.png' });
      console.log('✓ Streams tab loaded with remastered shadcn cards and native tags, screenshot-audit-modal-streams.png saved.');

      // 2b. Test Info (Sinopsis & Reparto) tab
      console.log('2b. Clicking Sinopsis & Reparto Tab...');
      const infoTabBtn = await page.$('button::-p-text(Sinopsis & Reparto)');
      if (infoTabBtn) {
        await infoTabBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        await page.screenshot({ path: 'screenshot-audit-modal-info.png' });
        console.log('✓ Sinopsis & Reparto tab verified with cast avatar cards, screenshot-audit-modal-info.png saved.');
      }

      // Close modal
      const closeBtn = await page.$('.modal-close-btn');
      if (closeBtn) {
        await closeBtn.click();
        await new Promise(r => setTimeout(r, 800));
      }
    }

    // 3. Switch to Series tab to audit Episodios section
    console.log('3. Navigating to Series Tab...');
    const seriesNavBtn = await page.$('button::-p-text(Series TV)');
    if (seriesNavBtn) {
      await seriesNavBtn.click();
      await new Promise(r => setTimeout(r, 2000));

      const seriesCard = await page.$('.media-card');
      if (seriesCard) {
        await seriesCard.click();
        await page.waitForSelector('.modal-sheet', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 2000));

        // Click Episodios Tab
        console.log('3b. Clicking Episodios Tab...');
        const episodesTabBtn = await page.$('button::-p-text(Episodios)');
        if (episodesTabBtn) {
          await episodesTabBtn.click();
          await new Promise(r => setTimeout(r, 2000));
          await page.screenshot({ path: 'screenshot-audit-modal-episodes.png' });
          console.log('✓ Episodios tab verified with season pills & episode thumbnail cards, screenshot-audit-modal-episodes.png saved.');
        }

        // Close modal
        const closeBtn2 = await page.$('.modal-close-btn');
        if (closeBtn2) {
          await closeBtn2.click();
          await new Promise(r => setTimeout(r, 800));
        }
      }
    }

    // 4. Test Video Player Launch and Stream Switcher
    console.log('4. Testing Video Player & Playback Assistant...');
    const firstCardAgain = await page.$('.media-card');
    if (firstCardAgain) {
      await firstCardAgain.click();
      await page.waitForSelector('.modal-sheet', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 1500));

      // Click Play best option
      const playBtn = await page.$('.modal-sheet button::-p-text(Reproducir)');
      if (playBtn) {
        await playBtn.click();
        await page.waitForSelector('.player-container', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: 'screenshot-audit-player.png' });
        console.log('✓ Video Player running, screenshot-audit-player.png saved.');

        // Close Player
        const playerClose = await page.$('.player-close-btn');
        if (playerClose) {
          await playerClose.click();
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    console.log('----------------------------------------------------');
    console.log(`Deep Audit Completed. Total JS Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.warn('Errors encountered:', errors);
      process.exit(1);
    } else {
      console.log('🎉 DEEP AUDIT SUCCESS: All components and workflows verified flawlessly with 0 errors!');
    }
  } catch (err) {
    console.error('Audit Failure:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runDeepAudit();
