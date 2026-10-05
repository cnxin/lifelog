// Used only by css-coverage's measurement children, not normal standalone gates.
const { chromium } = require('playwright');
const { instrumentBrowser } = require('./css-coverage.cjs');
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => instrumentBrowser(await launch(...args), process.env.CSS_COVERAGE_DIR);
