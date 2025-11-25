import { getAnalytics } from '../lib/analytics';

getAnalytics()
  .trackHttpRequest('GET', '/', 200, 10)
  .then(() => {
    console.log('tracked');
  })
  .catch(err => {
    console.error('analytics error', err);
  });
