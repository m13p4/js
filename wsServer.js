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
    function wSocketServer(httpServer, opts, onConnect)
    {
        if(!httpServer) throw new Error("require a http server");
        if(typeof opts === "function") onConnect = opts, opts = {};

        const Crypto  = require('crypto');
        const Types   = require('util').types;
        const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        
        function readData(ws, buff)
        {
            if(!ws.readWorker)
            {
                ws.readWorker = new Threads.Worker(__filename, {workerData: ws.srv.opts});
                ws.readWorker.on("error", function(err) { ws.events.emit("error", err, ws); });
                ws.readWorker.on("exit", function()     { delete ws.readWorker; });
                ws.readWorker.on("message", function(msg)
                {
                    if(msg.err)
                    {
                        ws.events.emit("error", [msg.err[1], msg], ws);
                        (ws.srv.opts.closeOnError || msg.err[2]) && delWSocket(ws, msg.err);
                        return;
                    }
                    msg.data = Buffer.from(msg.data ? msg.data.buffer : []);
                    
                    if(msg.opcode === 8) // close frame
                        delWSocket(ws, [msg.data[0] << 8 | msg.data[1]]);
                    else if(msg.opcode === 9) //ping
                    {
                        sendData(ws, msg.data, {opcode: 10});
                        ws.events.emit("ping", [msg.data, ws.pingstate, msg], ws);
                    }
                    else if(msg.opcode === 10) //pong
                    {
                        if(ws.pingData.equals(msg.data))  ws.pingstate = 0;
                        ws.events.emit("pong", [msg.data, ws.pingstate, msg], ws);
                    }
                    else ws.events.emit("data", [msg.data, msg], ws);
                });
            }
            ws.readWorker.postMessage(buff);
        }
        function getRandomBytes(length, asByteArray)
        {
            var bytes = [], i = 0; length = length || 1;
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
            let mask   = "mask"   in opts ? opts.mask   : false;
            let opcode = "opcode" in opts ? opts.opcode : data && (Buffer.isBuffer(data) ||
                                                          Types.isAnyArrayBuffer(data)   ||
                                                          Types.isArrayBufferView(data))  ? 2 : 1;
            data = Buffer.from(data || []);

            let maskKey = mask ? getRandomBytes(4) : null;
            let length  = data.length;
            let buff    = Buffer.allocUnsafe(length + (length < 126 ? 2 : length < 65536 ? 4 : 10) + (mask ? 4 : 0));

            buff[0] = fin ? 1 : 0;
            buff[0] = buff[0] << 1 | (rsv1 ? 1 : 0);
            buff[0] = buff[0] << 1 | (rsv2 ? 1 : 0);
            buff[0] = buff[0] << 1 | (rsv3 ? 1 : 0);
            buff[0] = buff[0] << 4 | opcode;

            buff[1] = (mask ? 1 << 7 : 0) | (length < 126 ? length : length < 65536 ? 126 : 127);

            let pos = 2;
            if(length > 125)
            {
                if(length < 65536) buff.writeUInt16BE(length, (pos += 2) - 2);
                else               buff.writeBigUInt64BE(BigInt(length), (pos += 8) - 8);
            }

            if(mask)
            {
                maskKey.copy(buff, (pos += 4) - 4);
                
                for(let i = 0; i < maskKey.length; i++)
                    maskKey[i] = ~maskKey[i];
                for(let i = 0; i < data.length; i++)    
                    buff[pos++] = ~data[i] ^ maskKey[i % 4];
            }
            else data.copy(buff, pos);
            
            !ws.socket.destroyed && ws.socket.write(buff);
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

                    let eventList = this.list[name] || [];
                    for(let i = 0; i < eventList.length; i++)
                        setImmediate(function(a,b,c){a.apply(b,c);}, eventList[i], thisArg, args);
                },
                clear: function(name)
                {
                    if(!name)                  this.list       = {};
                    else if(name in this.list) this.list[name] = [];
                }
            };
        }
        function getWSocket(socket, srv)
        {
            let ws = {
                id:     Date.now().toString(36) + BigInt("0x1"+getRandomBytes(16).toString("hex")).toString(36),
                srv:    srv,
                socket: socket,
                events: getEventHandler(),

                send: function(msg, opts)
                {
                    setImmediate(sendData, this, msg, opts);
                    return this;
                },
                on: function(eventName, callBack)
                {
                    this.events.on(eventName, callBack);
                    return this;
                },
                close: function(code, reason)
                {
                    delWSocket(this, [code, reason]);
                },
                pingstate: 0,
                pingInterval: srv.opts.pingInterval ? setInterval(function()
                {
                    ws.pingstate++;
                    ws.pingData = getRandomBytes(6);
                    sendData(ws, ws.pingData, {opcode: 9});
                    ws.events.emit("ping", [ws.pingData, ws.pingstate], ws);
                }, srv.opts.pingInterval) : false
            };
            
            return ws;
        }
        function delWSocket(ws, closeData)
        {
            if(closeData)
            {
                let _code   = closeData[0] && Number.isInteger(closeData[0]) ? closeData[0] : false;
                let _reason = closeData[1] && closeData[1] instanceof Error  ? closeData[1].message 
                                          : typeof closeData[1] === "string" ? closeData[1] : false;
                
                let closeBuff = Buffer.allocUnsafe((_reason ? _reason.length : 0) + (_code ? 2 : 0));
                _code   && closeBuff.writeUInt16BE(_code);
                _reason && closeBuff.write(_reason, _code ? 2 : 0);
                sendData(ws, closeBuff, {opcode: 8});
            }
            
            var id = ws.id, srv = ws.srv;

            ws.pingInterval && clearInterval(ws.pingInterval);
            ws.socket.removeAllListeners();
            ws.socket.end();
            
            ws.events.emit("end", [], ws);
            ws.events.emit("close", closeData, ws);
            if(id in srv.wsList) delete srv.wsList[id];
            setImmediate(function(){ws.events.clear();});
            
            let _ws = ws; setTimeout(function()
            { 
                _ws.socket && !_ws.socket.destroyed && _ws.socket.destroy(); 
                for(var i in _ws) _ws[i] = null;
            }, 1000);
        }

        let wsServer = {
            httpServer: httpServer,
            events: getEventHandler(),
            wsList: {},

            listen: function(port, callback)
            {
                this.httpServer.listen(port, callback||function(){});
                return this;
            },
            on: function(eventName, callBack)
            {
                this.events.on(eventName, callBack);
                return this;
            },
            opts: Object.assign({
                playLoadLimit: 2 ** 27, //128 MiB
                closeOnError:  !true,
                closeOnUnknownOpcode: true, 
                closeOnUnmaskedFrame: true, //rfc6455#section-5.1
                pingInterval: 1000 * 30     //rfc6455#section-5.5.2
            }, opts || {})
        };
        
        typeof onConnect === "function" && wsServer.on("connect", onConnect);

        wsServer.httpServer.on("upgrade", function(req, socket)
        {
            if(req.headers.upgrade !== 'websocket')
                return socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');

            if(!("sec-websocket-key" in req.headers))
                return socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');

            let swa = Crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + WS_GUID).digest("base64");
            let ws  = getWSocket(socket, wsServer);
            
            ws.socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                          + "Connection: Upgrade\r\nSec-WebSocket-Accept: " + swa+ "\r\n\r\n");

            ws.socket.on("data",  function(d) { readData(ws, d); });
            ws.socket.on("close", function(e) { delWSocket(ws, [1001, e]); });
            ws.socket.on("end",   function()  { delWSocket(ws); });
            ws.socket.on("error", function(e)
            {
                ws.events.emit("error", e, ws);
                wsServer.opts.closeOnError && delWSocket(ws, [1011, e]);
            });
            ws.socket.on("timeout", function()
            {
                ws.events.emit("timeout", [], ws);
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
    var data = new Uint8Array(0), opts = Object.assign({
            playLoadLimit: BigInt(2) ** BigInt(64)
        }, Threads.workerData), msgReader, exitTimeOut, 
        bigIntLimit = BigInt(2) ** BigInt(53),
        opcodes = [0, 1, 2, 8, 9, 10];
    
    Threads.parentPort.on("message", function(d)
    {
        if(exitTimeOut) exitTimeOut = clearTimeout(exitTimeOut);
        
        let _data = new Uint8Array(data.length + d.length);
        _data.set(data); _data.set(d, data.length); data = _data;
        
        let offset = msgReader ? 0 : 2;
        if(!msgReader)
        {
            msgReader = {
                opcode: data[0] & 0b1111,
                fin:    !!(data[0] >> 7),
                rsv1:   !!(data[0] >> 6 & 1),
                rsv2:   !!(data[0] >> 5 & 1),
                rsv3:   !!(data[0] >> 4 & 1),
                mask:   !!(data[1] >> 7),
                length: data[1] & 0b1111111,
                read:   -1
            };
            
            if(msgReader.length === 126)
                msgReader.length = data[offset++] << 8 | data[offset++];
            else if(msgReader.length === 127)
            {
                msgReader.length = Buffer.from(data.slice(offset, offset += 8)).readBigUInt64BE();
                msgReader.length = msgReader.length < bigIntLimit ? parseInt(msgReader.length) : msgReader.length /*@todo: handle BigInt in following code*/;
            }
            
            if(opts.closeOnUnknownOpcode && opcodes.indexOf(msgReader.opcode) < 0)
                msgReader.err = [1003, new Error("unknown opcode ("+msgReader.opcode+")"), true];
            else if(opts.closeOnUnmaskedFrame && !msgReader.mask)
                msgReader.err = [1002, new Error("recieved frame is not masked"), true];
            else if(msgReader.length > opts.playLoadLimit)
                msgReader.err = [1009, new Error("message length ("+msgReader.length+") > playLoadLimit")];
            else if(msgReader.opcode > 2 && msgReader.length > 125)
                msgReader.err = [1002, new Error("control frame length ("+msgReader.length+") > 125")];
            
            msgReader.data = msgReader.err ? false : new Uint8Array(new SharedArrayBuffer(msgReader.length));
        }
        
        if(msgReader.err && (opts.closeOnError || msgReader.err[2]))
        {
            Threads.parentPort.postMessage(msgReader);
            process.exit(1);
        }
        
        if(msgReader.mask && !msgReader.maskKey && offset + 4 <= data.length)
        {
            msgReader.read    = 0;
            msgReader.maskKey = data.slice(offset, offset += 4);
        }
        else if(msgReader.read < 0 && !msgReader.mask)
            msgReader.read = 0;

        if(msgReader.read >= 0)
        {
            let toReadBytes = msgReader.length - msgReader.read;
            toReadBytes = toReadBytes <= data.length - offset 
                            ? toReadBytes : data.length - offset;
                            
            if(msgReader.data)
            {
                _data = data.slice(offset, offset + toReadBytes);

                if(msgReader.mask) for(let i = 0; i < _data.length; i++)
                        msgReader.data[msgReader.read] = _data[i] 
                            ^ msgReader.maskKey[msgReader.read++ % 4];
                else 
                    msgReader.data.set(_data, (msgReader.read += _data.length) - _data.length);
            }
            else msgReader.read += toReadBytes;
            
            if(msgReader.length === msgReader.read)
            {
                Threads.parentPort.postMessage(msgReader);
                msgReader   = false;
                exitTimeOut = setTimeout(function(){process.exit();}, 1000);
            }
            data = data.slice(offset + toReadBytes);
        }
    });
}
