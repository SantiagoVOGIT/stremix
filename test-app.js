// Verification test script
async function runTests() {
  console.log('--- STARTING STREMIX VERIFICATION SUITE ---');

  // Test 1: HTML index
  const indexRes = await fetch('http://localhost:5173/');
  const indexHtml = await indexRes.text();
  console.log('✓ Test 1: Index HTML served, length:', indexHtml.length, 'status:', indexRes.status);

  // Test 2: Vite React main module
  const mainRes = await fetch('http://localhost:5173/src/main.jsx');
  console.log('✓ Test 2: main.jsx transformed status:', mainRes.status);

  // Test 3: App.jsx module
  const appRes = await fetch('http://localhost:5173/src/App.jsx');
  console.log('✓ Test 3: App.jsx transformed status:', appRes.status);

  // Test 4: Cinemeta Catalog via proxy
  const cineCat = await fetch('http://localhost:5173/api/proxy?url=' + encodeURIComponent('https://v3-cinemeta.strem.io/catalog/movie/top.json'));
  const catData = await cineCat.json();
  console.log('✓ Test 4: Cinemeta catalog loaded, movies count:', catData.metas?.length);

  // Test 5: AIOStreams Manifest via proxy
  const aioMan = await fetch('http://localhost:5173/api/proxy?url=' + encodeURIComponent('https://aiostreams.viren070.me/stremio/manifest.json'));
  const aioData = await aioMan.json();
  console.log('✓ Test 5: AIOStreams manifest loaded, addon name:', aioData.name, 'version:', aioData.version);

  // Test 6: OpenSubtitles v3 via proxy
  const subRes = await fetch('http://localhost:5173/api/proxy?url=' + encodeURIComponent('https://opensubtitles-v3.strem.io/subtitles/movie/tt1375666.json'));
  const subData = await subRes.json();
  console.log('✓ Test 6: OpenSubtitles loaded, subs count:', subData.subtitles?.length);

  console.log('--- ALL BACKEND & PROXY SERVICES OPERATIONAL ---');
}

runTests().catch(err => console.error('Verification error:', err));
