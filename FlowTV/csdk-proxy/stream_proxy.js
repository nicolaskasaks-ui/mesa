const http = require('http');
const https = require('https');
const PORT = 8771;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  if (url.pathname === '/stream') {
    const name = url.searchParams.get('name');
    if (!name) { res.writeHead(400); res.end('Need name'); return; }
    
    const cdnUrl = `https://cdn.cvattv.com.ar/live/c7eds/${name}/SA_Live_dash_enc/${name}.mpd`;
    
    try {
      const location = await new Promise((resolve, reject) => {
        const r = https.get(cdnUrl, {headers: {'User-Agent': 'Mozilla/5.0'}}, (response) => {
          if (response.statusCode === 302) {
            resolve(response.headers.location);
          } else {
            let body = '';
            response.on('data', d => body += d);
            response.on('end', () => resolve(null));
          }
          response.resume();
        });
        r.on('error', reject);
        r.setTimeout(5000);
      });
      
      if (location) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({url: location, format: 'dash'}));
      } else {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'No stream found'}));
      }
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({error: e.message}));
    }
    return;
  }
  
  // Proxy MPD - fetch DASH manifest and serve it
  if (url.pathname === '/mpd') {
    const mpdUrl = url.searchParams.get('url');
    if (!mpdUrl) { res.writeHead(400); res.end('Need url'); return; }
    
    try {
      const data = await fetchUrl(mpdUrl);
      res.writeHead(200, {'Content-Type': 'application/dash+xml', 'Access-Control-Allow-Origin': '*'});
      res.end(data);
    } catch(e) {
      res.writeHead(500); res.end(e.message);
    }
    return;
  }
  
  if (url.pathname === '/status') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ready: true}));
    return;
  }
  
  res.writeHead(404); res.end('Not found');
});

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {headers: {'Origin': 'https://portal.app.flow.com.ar'}}, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

server.listen(PORT, () => console.log(`Stream proxy on :${PORT}`));
