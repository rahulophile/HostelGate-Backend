// test-server.js
const http = require("http");

const server = http.createServer((req, res) => {
  console.log("Test server got request:", req.method, req.url);
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK from plain Node server\n");
});

const PORT = 4000;

server.listen(PORT, () => {
  console.log(`🚀 Plain test server running on port ${PORT}`);
});
