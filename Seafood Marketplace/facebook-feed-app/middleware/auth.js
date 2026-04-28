function requireApiKey(req, res, next) {
  const expected = process.env.ADSCALE_API_KEY;
  if (!expected) {
    return res.status(500).json({ error: 'Missing ADSCALE_API_KEY' });
  }

  const provided = req.get('x-api-key') || '';
  if (provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

function requireWorkerToken(req, res, next) {
  const expected = process.env.WORKER_SHARED_TOKEN;
  if (!expected) {
    return res.status(500).json({ error: 'Missing WORKER_SHARED_TOKEN' });
  }

  const provided = req.get('x-worker-token') || '';
  if (provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized worker call' });
  }

  return next();
}

module.exports = {
  requireApiKey,
  requireWorkerToken
};
