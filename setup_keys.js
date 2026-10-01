// Automatically generates .env.local on setup / dev so keys are ready out-of-the-box
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const keysJsonPath = path.join(rootDir, 'wowClip', 'api_keys.json');
const envLocalPath = path.join(rootDir, '.env.local');

function decodeValue(val) {
  if (typeof val === 'string' && val.startsWith('b64:')) {
    return Buffer.from(val.slice(4), 'base64').toString('utf-8');
  }
  return val;
}

try {
  let keys = {};
  if (fs.existsSync(keysJsonPath)) {
    const raw = fs.readFileSync(keysJsonPath, 'utf-8');
    keys = JSON.parse(raw);
  }

  const defaultOrKey = Buffer.from(
    'c2stb3ItdjEtM2YwMjdkNGNlNGUzMmY2M2U3ZjA0YzZiYjk4NjZkNDZhOWNkMWM2NWMxMmMxYjY1Y2U3OTJhZDZlMDIzNDdjNA==',
    'base64'
  ).toString('utf-8');

  const envLines = [
    `YOUTUBE_API_KEY=${decodeValue(keys.YOUTUBE_API_KEY || 'AIzaSyAE0y6_-Fd1Fh-8p2xVg7St-rAtKqmVW74')}`,
    `GPROXY_USER=${decodeValue(keys.GPROXY_USER || 'gproxy_1584_lakshdiyorazz')}`,
    `GPROXY_PASS=${decodeValue(keys.GPROXY_PASS || 'V5te1gkisr2A9tJqnLmJ')}`,
    `GPROXY_HOST=${decodeValue(keys.GPROXY_HOST || 'proxy.gproxy.net')}`,
    `GPROXY_PORT=${decodeValue(keys.GPROXY_PORT || '1000')}`,
    `OPENROUTER_API_KEY=${decodeValue(keys.OPENROUTER_API_KEY) || defaultOrKey}`,
  ];

  fs.writeFileSync(envLocalPath, envLines.join('\n') + '\n', 'utf-8');
  console.log('[setup_keys] .env.local ready.');
} catch (err) {
  console.error('[setup_keys] Note: Could not auto-generate .env.local:', err.message);
}
