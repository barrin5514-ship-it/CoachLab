import express from 'express';
import './config.js';

const app = express();
app.use(express.json());

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok', service: 'CoachLab API' });
});

app.use((request, response) => {
  response.status(404).json({ error: 'Route not found.' });
});

app.use((error, request, response, next) => {
  const status = error.status === 400 ? 400 : 500;
  response.status(status).json({
    error: status === 400 ? 'Request body must contain valid JSON.' : 'Unexpected server error.',
  });
});

app.listen(3001, '127.0.0.1', () => {
  console.log('CoachLab API listening at http://127.0.0.1:3001');
}).on('error', () => {
  console.error('Could not start CoachLab API. Check whether port 3001 is already in use.');
  process.exitCode = 1;
});
