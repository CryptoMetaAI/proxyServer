import http from 'http'
import httpProxy from 'http-proxy'
import superagent from 'superagent'
import Hashes from 'jshashes'
import * as dotenv from 'dotenv'

import { Logger } from './logger.js';

var SHA1 = new Hashes.SHA1
var logger = new Logger('debug');

dotenv.config()
const { blockpiKey, port, cacheOpen } = process.env

var proxy = httpProxy.createProxyServer();

proxy.on('error', function(err, req, res) {
    logger.error("Error: ", err.message);
    res.end();
});

proxy.on('proxyRes', function (proxyRes, req, res) {
        var body = [];
        proxyRes.on('data', function (chunk) {
            body.push(chunk);
        });
        proxyRes.on('end', function () {
            body = Buffer.concat(body).toString();
            logger.debug("res from proxied server:", body);
            res.end("my response to cli");
        });
});

let cache = {startTime: new Date().getTime()}
logger.debug(JSON.stringify(cache))

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
        logger.debug('bodyHash', bodyHash)
        if (cacheOpen && cache[bodyHash] && cache[bodyHash].timestamp + 6000 > curTime) {
            logger.debug(`${curTime} -- ${req.method} ${req.headers.host}${req.url} ${body} -- response OK(in cache time:${cache[bodyHash].timestamp})`)
            res.end(cache[bodyHash].response)
            return
        }
        if (cache.startTime + 3600000 < curTime) {
            cache = {startTime: curTime}
        }
        superagent.post(`https://base.blockpi.network/v1/rpc/${blockpiKey}`)
        .send(body)
        .then(res1 => {
            logger.debug(`${req.method} ${req.headers.host}${req.url} -- ${body} -- response OK`)
            res.end(res1.text)
            if (cacheOpen) {
                cache[bodyHash] = {
                    response: res1.text,
                    timestamp: curTime
                }
            }
        })
    })
    
});

proxy_server.listen(port, function() {
    logger.debug('proxy server is running ');
});