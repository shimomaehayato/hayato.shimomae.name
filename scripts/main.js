(function() {
  'use strict';

  function main() {
    const preloads = document.querySelectorAll('link[rel="preload"]');
    preloads.forEach(preload => {
      preload.rel = 'stylesheet';
    });
  }

  main();
})();
