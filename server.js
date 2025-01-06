require('dotenv').config();

const WebSocket = require('ws');
const AWS = require('aws-sdk');

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
            const now = Date.now();

            await dynamo.put({
                TableName: process.env.TABLE_NAME || 'messages',
                Item: {
                    room: "default",
                    createAt: now,
                    user: data.user,
                    text: data.text
                }
            }).promise();

            const broadcastMsg = { ...data, room: "default", createAt: now};
            for(const client of clients){
                if(client.readyState === WebSocket.OPEN){
                    client.send(JSON.stringify(broadcastMsg));
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


console.log('WebSocket 서버가 8081 포트에서 대기 중...');
