/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.mp4':'video/mp4','.json':'application/json'};
http.createServer((request,response) => {
  let name;
  try { name = decodeURIComponent(new URL(request.url,'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep)) {response.writeHead(403).end();return;}
  fs.stat(file,(error,stat) => {
    if(error || !stat.isFile()){response.writeHead(404).end('Not found');return;}
    response.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
    const stream=fs.createReadStream(file);
    stream.on('error',()=>response.destroy());
    stream.pipe(response);
  });
}).listen(5500,'127.0.0.1',()=>console.log('Astro_Bytes: http://127.0.0.1:5500/'));
