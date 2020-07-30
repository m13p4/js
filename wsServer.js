/**
 * a ws server implementation
 * 
 * @version 1.0
 *
 * @author m13p4
 * @copyright Meliantchenkov Pavel
 */
const Threads = require('worker_threads');

if(Threads.isMainThread)
{
    const Crypto = require('crypto');
    
    function wSocketServer(httpServer, onConnect)
    {
        if(!httpServer) throw new Error("require a http server");

        const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        function readData(ws, buff)
        {
            if(!ws.readWorker)
            {
                ws.readWorker = new Threads.Worker(__filename);
                ws.readWorker.on("error", function(err)
                {
                    ws.events.emit("error", err);
                });
                ws.readWorker.on("exit", function()
                {
                    delete ws.readWorker;
                });
                ws.readWorker.on("message", function(msg)
                {
                    msg.data = Buffer.from(msg.data || []);
                    
                    if(msg.opcode === 8) delWSocket(ws); // close frame
                    else if(msg.opcode === 9) //ping
                    {
                        sendData(ws, msg.data, {opcode: 10});
                        ws.events.emit("ping", msg.data, ws);
                    }
                    else if(msg.opcode === 10) //pong
                    {
                        ws.isOpen = msg.data === ws.pingData;
                        ws.events.emit("pong", msg.data, ws);
                    }
                    else ws.events.emit("data", [msg.data, msg.fin], ws);
                });
            }
            ws.readWorker.postMessage(buff);
        }
        function getRandomBytes(length, asByteArray)
        {
            length = length || 1;
            var bytes = [], i = 0;
            for(; i < length; i++)
                bytes.push(parseInt(Math.random() * 255));

            return asByteArray ? bytes : Buffer.from(bytes);
        }
        function sendData(ws, data, opts)
        { //todo: send long messages in parts
            opts = opts || {};

            let fin    = "fin"    in opts ? opts.fin    : true;
            let rsv1   = "rsv1"   in opts ? opts.rsv1   : false;
            let rsv2   = "rsv2"   in opts ? opts.rsv2   : false;
            let rsv3   = "rsv3"   in opts ? opts.rsv3   : false;
            let opcode = "opcode" in opts ? opts.opcode : 1;
            let mask   = "mask"   in opts ? opts.mask   : true;

            data = Buffer.from(data);

            let maskKey = mask ? getRandomBytes(4) : null;
            let length  = data.length;             
            let buff    = Buffer.from([]);

            let tmp = fin ? 1 : 0;
            tmp = tmp << 1 | (rsv1 ? 1 : 0);
            tmp = tmp << 1 | (rsv2 ? 1 : 0);
            tmp = tmp << 1 | (rsv3 ? 1 : 0);
            tmp = tmp << 4 | opcode;
            buff = Buffer.concat([buff, Buffer.from([tmp])]);

            tmp = mask ? 1 : 0;
            tmp = tmp << 7 | (length < 126 ? length : length < 65536 ? 126 : 127);
            buff = Buffer.concat([buff, Buffer.from([tmp])]);

            if(length > 125)
            {
                if(length < 65536)
                {
                    tmp = Buffer.allocUnsafe(2);
                    tmp.writeUInt16BE(length);
                }
                else
                {
                    tmp = Buffer.allocUnsafe(8);
                    tmp.writeBigUInt64BE(BigInt(length));
                }
                buff = Buffer.concat([buff, tmp]);
            }
            buff = Buffer.concat([buff, maskKey]);

            if(mask)
            {
                let toMask = [];
                for(let i = 0; i < maskKey.length; i++)
                    toMask.push(~maskKey[i]);

                for(let i = 0; i < data.length; i++)
                    data[i] = ~data[i] ^ toMask[i % 4];
            }

            buff = Buffer.concat([buff, data])

            ws.socket.write(buff);
        }
        function getEventHandler()
        {
            return {
                list: {},
                on: function(name, callback)
                {
                    if(typeof callback !== "function") return;

                    if(!(name in this.list))
                        this.list[name] = [];

                    this.list[name].push(callback);
                },
                emit: function(name, args, thisArg)
                {
                    if(!(name in this.list)) return;
                    args = args instanceof Array ? args : [args];

                    let eventList = this.list[name];
                    process.nextTick(function()
                    {
                        for(let i = 0; i < eventList.length; i++)
                            eventList[i].apply(thisArg, args);
                    });
                }
            };
        }
        function getWSocket(socket, srv)
        {
            let ws = {
                id: (Math.random()*Date.now()) + "." + Date.now(),
                socket: socket,
                events: getEventHandler(),

                send: function(msg)
                {
                    setImmediate(sendData, this, msg);
                },
                on: function(eventName, callBack)
                {
                    this.events.on(eventName, callBack);
                },
                inReadMode: false,
                isOpen: false,
                pingInterval: setInterval(function()
                {
                    ws.isOpen   = false;
                    ws.pingData = parseInt(Date.now() * Math.random()).toString(36);
                    sendData(ws, ws.pingData, {opcode: 9});
                }, 1000 * 15),

                srv: srv
            };

            return ws;
        }
        function delWSocket(ws)
        {
            var id = ws.id, srv = ws.srv;
            ws.isOpen = false;
            ws.inReadMode = false;

            ws.pingInterval && clearInterval(ws.pingInterval);
            ws.socket.end();

            if(id in srv.wsList) 
                delete srv.wsList[id];
        }

        let wsServer = {
            httpServer: httpServer,
            events: getEventHandler(),
            wsList: {},

            listen: function(port, callback)
            {
                this.httpServer.listen(port, callback||function(){});
            },
            on: function(eventName, callBack)
            {
                this.events.on(eventName, callBack);
            }
        };

        typeof onConnect === "function" && wsServer.on("connect", onConnect);

        wsServer.httpServer.on("upgrade", function(req, socket)
        {
            if(req.headers.upgrade !== 'websocket')
                return socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');

            if(!("sec-websocket-key" in req.headers))
                return socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');

            let wsAcceptKey = Crypto.createHash("sha1")
                                    .update(req.headers["sec-websocket-key"] + WS_GUID)
                                    .digest("base64");

            socket.write("HTTP/1.1 101 Switching Protocols\r\n" 
                          + "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                          + "Sec-WebSocket-Accept: " +  wsAcceptKey + "\r\n\r\n");

            let ws = getWSocket(socket, wsServer);

            ws.socket.on("data", function(buff)
            {
                readData(ws, buff);
            });
            ws.socket.on("error", function(err)
            {
                ws.events.emit("error", err, ws);
            });
            ws.socket.on("close", function(hadError)
            {
                ws.events.emit("close", hadError, ws);
                delWSocket(ws);
            });
            ws.socket.on("timeout", function()
            {
                ws.events.emit("timeout", [], ws);
                delWSocket(ws);
            });
            ws.socket.on("end", function()
            {
                ws.events.emit("end", [], ws);
                delWSocket(ws);
            });

            wsServer.wsList[ws.id] = ws;
            wsServer.events.emit("connect", [req, ws], wsServer);
        });
        return wsServer;
    }
    module.exports = wSocketServer;
}
else //(read)worker part
{
    var msgReader, exitTimeOut, bigIntLimit = BigInt(2) ** BigInt(53);
    Threads.parentPort.on("message", function(data)
    {
        if(exitTimeOut) exitTimeOut = clearTimeout(exitTimeOut);
        
        let offset = msgReader ? 0 : 2;
        if(!msgReader)
        {
            msgReader = {
                opcode: data[0] & 0b1111,
                fin:    !!(data[0] >> 7),
                mask:   !!(data[1] >> 7),
                read:   -1,
            };
            
            if(msgReader.opcode === 8) //close frame
            {
                Threads.parentPort.postMessage({opcode: 8}); 
                return process.exit();
            }
            
            let length = data[1] & 0b1111111;
            if(length === 126)
            {
                length = data[offset] << 8 | data[offset + 1];
                offset += 2;
            }
            else if(length === 127)
            {
                length = Buffer.from(data.slice(offset, offset + 8)).readBigUInt64BE();
                length = length < bigIntLimit ? parseInt(length) : length;

                offset += 8;
            }
            msgReader.len  = length;
            msgReader.data = Buffer.from(new SharedArrayBuffer(length));
//            msgReader.data = Buffer.allocUnsafe(length);
        }

        if(msgReader.mask && !msgReader.maskKey && offset + 4 <= data.length)
        {
            msgReader.read    = 0;
            msgReader.maskKey = data.slice(offset, offset + 4);
            
            offset += 4;
        }
        else if(msgReader.read < 0 && !msgReader.mask)
            msgReader.read = 0;

        if(msgReader.read >= 0)
        {
            let toReadBytes = msgReader.len - msgReader.read;
            toReadBytes = toReadBytes <= data.length - offset 
                            ? toReadBytes : data.length - offset;
            let _data = data.slice(offset, offset + toReadBytes);

            if(msgReader.mask) for(let i = 0; i < _data.length; i++)
                    msgReader.data[msgReader.read] = _data[i] 
                        ^ msgReader.maskKey[msgReader.read++ % 4];
            else for(let i = 0; i < _data.length; i++)
                    msgReader.data[msgReader.read++] = _data[i];

            if(msgReader.len === msgReader.read)
            {
                Threads.parentPort.postMessage({
                    opcode: msgReader.opcode, 
                    data:   msgReader.data,
                    fin:    msgReader.fin
                });
                msgReader   = false;
                exitTimeOut = setTimeout(function(){process.exit();}, 1000);
            }
        }
    });
}
