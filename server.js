require('dotenv').config();

const WebSocket = require('ws');
const AWS = require('aws-sdk');
const http = require('http');
const path = require('path');
const fs = require('fs');

const server = http.createServer((req, res) => {
    const filepath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filepath);
    const contentType = {
        '.html' : 'text/html',
        '.js' : 'test/javascript',
    }[extname] || 'text/plain';

    fs.readFile(filepath, (err, content) => {
        if(err){
            res.writeHead(404);
            res.end('Page not found');
        } else{
            res.writeHead(200, {'Content-Type' : contentType });
            res.end(content, 'utf-8');
        }
    })
})

AWS.config.update({
    region: process.env.AWS_REGION || 'ap-northeast-2'
});


const dynamo = new AWS.DynamoDB.DocumentClient();
const wss = new WebSocket.WebSocketServer({ port : 8081 });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('클라이언트 접속');
    ws.on('message', async (message) => {
        try{
            const data = JSON.parse(message);

            if(data.type === 'init'){
                ws.userId = data.userId;
                console.log(`초기연결, userId : ${ws.userId}`);
                return;
            }

            if(data.type === 'chat'){
                console.log(data.text);
                const now = Date.now();

                await dynamo.put({
                    TableName: process.env.TABLE_NAME || 'messages',
                    Item: {
                        room: "default",
                        createAt: now,
                        user: data.userId,
                        text: data.text
                    }
                }).promise();

                const broadcastMsg = { ...data, room: "default", createAt: now};
                for(const client of clients){
                    if(client.readyState === WebSocket.OPEN){
                        client.send(JSON.stringify(broadcastMsg));
                    }
                }
            }
        } catch (err){
            console.error('메시지 처리 중 오류:', err);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('클라이언트 해제');
    });
});

const HTTP_PORT = 80;
server.listen(HTTP_PORT, () => {
    console.log('HTTP 서버가 80 포트에서 대기 중...')
})

const WS_PORT = 8081;
console.log('WebSocket 서버가 8081 포트에서 대기 중...');
