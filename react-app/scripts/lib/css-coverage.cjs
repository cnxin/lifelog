const fs = require('node:fs/promises');
const path = require('node:path');

// Measurement only: sourceURL gives anonymous Vite style elements a CDP identity.
// The only changed CSS bytes are a trailing comment; no declarations/rules change.
async function instrumentBrowser(browser, directory) {
  const pages = new Map();
  const contexts = new WeakSet();
  let sequence = 0;
  await fs.mkdir(directory, { recursive: true });
  const collect = async page => {
    if (!pages.has(page)) return;
    pages.delete(page);
    const entries = await page.coverage.stopCSSCoverage();
    await fs.writeFile(path.join(directory, `${process.env.CSS_COVERAGE_SUITE || 'tour'}-${process.pid}-${++sequence}.json`), JSON.stringify(entries));
  };
  const attach = async page => {
    if (pages.has(page)) return page;
    await page.coverage.startCSSCoverage({ resetOnNavigation: false });
    pages.set(page, true);
    const close = page.close.bind(page);
    page.close = async (...args) => { await collect(page); return close(...args); };
    return page;
  };
  const attachContext = async context => {
    if (contexts.has(context)) return context;
    contexts.add(context);
    await context.route('**/*.css*', async route => {
      const response = await route.fetch();
      let body = await response.text();
      const match = body.match(/const __vite__css = ("[^\n]*")/);
      if (match) {
        const css = JSON.parse(match[1]);
        body = body.replace(match[0], `const __vite__css = ${JSON.stringify(css + '\n/*# sourceURL=' + route.request().url() + ' */')}`);
      }
      await route.fulfill({ response, body });
    });
    const newPage = context.newPage.bind(context);
    context.newPage = async (...args) => attach(await newPage(...args));
    const close = context.close.bind(context);
    context.close = async (...args) => {
      for (const page of context.pages()) await collect(page);
      return close(...args);
    };
    return context;
  };
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => attachContext(await newContext(...args));
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (...args) => {
    const page = await newPage(...args);
    await attachContext(page.context());
    return attach(page);
  };
  const close = browser.close.bind(browser);
  browser.close = async (...args) => {
    for (const page of [...pages.keys()]) await collect(page);
    return close(...args);
  };
  return browser;
}

exports.instrumentBrowser = instrumentBrowser;
