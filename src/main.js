// Entry point.
import { boot } from './app.js';
boot().catch((e) => {
  console.error(e);
  const app = document.getElementById('app');
  if (app) app.textContent = 'EZICARGO could not start. Please reload the page.';
});
