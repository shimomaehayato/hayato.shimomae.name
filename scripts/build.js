import { readFile, writeFile } from 'fs';
import { minify } from 'html-minifier';
import jsdom from 'jsdom';
import mkdirp from 'mkdirp';
import path from 'path';
import postcss from 'postcss';
import postcssrc from 'postcss-load-config';

function mkdir(dir) {
  return new Promise((resolve, reject) => {
    mkdirp(dir, error => (error instanceof Error ? reject(error) : resolve()));
  });
}

function read(file) {
  return new Promise((resolve, reject) => {
    readFile(file, (error, data) => (error instanceof Error ? reject(error) : resolve(data)));
  });
}

function write(file, data) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(file);
    mkdir(dir)
      .then(() =>
        writeFile(file, data, error => (error instanceof Error ? reject(error) : resolve())))
      .catch(reject);
  });
}

function parse(...args) {
  return new Promise((resolve, reject) => {
    jsdom.env(...args, (error, window) =>
      (error instanceof Error ? reject(error) : resolve(window)));
  });
}

function generateCanonical({ document }) {
  const link = document.createElement('link');
  const canonical = document.querySelector('[rel="canonical"]');
  if (!canonical || !canonical.href) {
    return Promise.resolve(null);
  }
  link.setAttribute('href', canonical.href);
  link.setAttribute('rel', 'canonical');
  return Promise.resolve(link);
}

function generateBoilerplate({ document }) {
  const style = document.createElement('style');
  style.setAttribute('amp-boilerplate', '');
  style.textContent = [
    'body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;',
    '-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;',
    '-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;',
    'animation:-amp-start 8s steps(1,end) 0s 1 normal both}',
    '@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}',
    '@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}',
    '@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}',
    '@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}',
    '@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}',
  ].join('');
  return Promise.resolve(style);
}

function generateBoilerplateForNoScript({ document }) {
  const noscript = document.createElement('noscript');
  const style = document.createElement('style');
  noscript.appendChild(style);
  style.setAttribute('amp-boilerplate', '');
  style.textContent = 'body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}';
  return Promise.resolve(noscript);
}

async function generateStyle({ document }) {
  const file = path.join(__dirname, '..', 'styles', 'main.css');
  const buffer = await read(file);
  const { options, plugins } = await postcssrc({
    from: file,
  });
  const result = await postcss(plugins).process(buffer, options);
  const style = document.createElement('style');
  style.setAttribute('amp-custom', '');
  style.textContent = result.css.replace(/@charset\s+[^;]*;/, '');
  return style;
}

async function generateHead(window) {
  const { document } = window;
  const head = document.createElement('head');
  const charset = document.createElement('meta');
  charset.setAttribute('charset', 'UTF-8');
  head.appendChild(charset);
  const viewport = document.createElement('meta');
  viewport.setAttribute('name', 'viewport');
  viewport.setAttribute('content', 'initial-scale=1,minimum-scale=1,width=device-width');
  head.appendChild(viewport);
  const canonical = await generateCanonical(window);
  if (canonical) {
    head.appendChild(canonical);
  }
  const title = document.createElement('title');
  title.textContent = document.title;
  head.appendChild(title);
  [...document.querySelectorAll('[type="application/ld+json"]')].forEach((jsonLd) => {
    const schema = JSON.parse(jsonLd.textContent);
    const script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(schema);
    head.appendChild(script);
  });
  const boilerplate = await generateBoilerplate(window);
  const boilerplateForNoScript = await generateBoilerplateForNoScript(window);
  head.appendChild(boilerplate);
  head.appendChild(boilerplateForNoScript);
  const style = await generateStyle(window);
  head.appendChild(style);
  const ampAnalytics = document.createElement('script');
  ampAnalytics.setAttribute('async', '');
  ampAnalytics.setAttribute('custom-element', 'amp-analytics');
  ampAnalytics.setAttribute('src', 'https://cdn.ampproject.org/v0/amp-analytics-0.1.js');
  head.appendChild(ampAnalytics);
  const script = document.createElement('script');
  script.setAttribute('async', '');
  script.setAttribute('src', 'https://cdn.ampproject.org/v0.js');
  head.appendChild(script);
  return head;
}

function generateBody({ document }) {
  const body = document.body.cloneNode(true);
  [...body.getElementsByTagName('script')].forEach(script => script.remove());
  const ampAnalytics = document.createElement('amp-analytics');
  ampAnalytics.setAttribute('type', 'googleanalytics');
  const script = document.createElement('script');
  script.setAttribute('type', 'application/json');
  script.textContent = JSON.stringify({
    vars: {
      account: 'UA-89846829-2',
    },
    triggers: {
      trackPageview: {
        on: 'visible',
        request: 'pageview',
      },
    },
  });
  ampAnalytics.appendChild(script);
  body.appendChild(ampAnalytics);
  return Promise.resolve(body);
}

async function generateHtml(window) {
  const { document } = window;
  const html = document.documentElement.cloneNode();
  html.setAttribute('amp', '');
  const head = await generateHead(window);
  const body = await generateBody(window);
  html.appendChild(head);
  html.appendChild(body);
  return html;
}

async function generate(window) {
  const html = await generateHtml(window);
  return `<!DOCTYPE html>\n${html.outerHTML}`;
}

async function main() {
  const file = path.join(__dirname, '..', 'index.html');
  const buffer = await read(file);
  const window = await parse(buffer.toString());
  const html = minify(await generate(window), {
    caseSensitive: true,
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    html5: true,
    removeAttributeQuotes: true,
    removeComments: true,
    removeEmptyAttributes: true,
    removeScriptTypeAttributes: true,
    sortAttributes: true,
    sortClassName: true,
  }).replace(/(amp(?:-[^=]+)?)=""/, (_, name) => name);
  const output = path.join(__dirname, '..', 'amp', 'index.html');
  await write(output, html);
}

// eslint-disable-next-line no-console
main().catch(console.error.bind(console));
