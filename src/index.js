var http = require('http')
var httpProxy = require('http-proxy')
var superagent = require('superagent')
var Hashes = require('jshashes')
var dotenv = require('dotenv')
var SHA1 = new Hashes.SHA1

dotenv.config()
const { blockpiKey } = process.env

var proxy = httpProxy.createProxyServer();

proxy.on('error', function(err, req, res) {
    console.log("Error: ", err.message);
    res.end();
});

proxy.on('proxyRes', function (proxyRes, req, res) {
        var body = [];
        proxyRes.on('data', function (chunk) {
            body.push(chunk);
        });
        proxyRes.on('end', function () {
            body = Buffer.concat(body).toString();
            console.log("res from proxied server:", body);
            res.end("my response to cli");
        });
});

let cache = {startTime: new Date().getTime()}
console.log(JSON.stringify(cache))

var proxy_server = http.createServer(function(req, res) {

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Api-Key, X-Requested-With, Content-Type, Accept, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS')
    res.setHeader('Access-Control-Max-Age', 86400000)
    res.setHeader('X-Powered-By', '3.2.1')
    res.setHeader('Content-Type', 'application/json;charset=utf-8')

    if (req.method === "OPTIONS") {
        res.status = 204
        res.end('{}')
        return
    }     

    var body = '';

    req.on('data', function(data) {
        body += data;
    })

    req.on('end', function() {
        const curTime = new Date().getTime()
        const bodyWithoutId = delete JSON.parse(body).id
        const bodyHash = SHA1.hex(JSON.stringify(bodyWithoutId));
        console.log('bodyHash', bodyHash)
        if (cache[bodyHash] && cache[bodyHash].timestamp + 6000 > curTime) {
            console.log(`${curTime} -- ${req.method} ${req.headers.host}${req.url} ${body} -- response OK(in cache time:${cache[bodyHash].timestamp})`)
            res.end(cache[bodyHash].response)
            return
        }
        if (cache.startTime + 3600000 < curTime) {
            cache = {startTime: curTime}
        }
        superagent.post(`https://base.blockpi.network/v1/rpc/${blockpiKey}`)
        .send(body)
        .then(res1 => {
            console.log(`${req.method} ${req.headers.host}${req.url} -- ${body} -- response OK`)
            res.end(res1.text)
            cache[bodyHash] = {
                response: res1.text,
                timestamp: curTime
            }
        })
    })
    
});

proxy_server.listen(8080, function() {
    console.log('proxy server is running ');
});