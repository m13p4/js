/**
 * a ws server implementation
 * 
 * @version 1.0
 *
 * @author m13p4
 * @copyright Meliantchenkov Pavel
 */
const Crypto = require('crypto');

function wSocketServer(httpServer, onConnect)
{
    const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    
    if(!httpServer)
        throw new Error("require a http server");
    
    function readData(ws, buff)
    {
        if(!ws.inReadMode)
        {
            ws.msgReader = {
                offset: 0,
                data: Buffer.from([]),
                readPlayload: false
            };
            
            let byte1  = buff.readUInt8(0);
            let byte2  = buff.readUInt8(1);
            
            ws.msgReader.offset   = 2;
            ws.msgReader.fin      = !!(byte1 >> 7); 
            ws.msgReader.dataType = byte1 & 0b1111; // 1 => text message (utf8); 2 => binary message; 8 => connection termination

            ws.msgReader.mask = !!(byte2 >> 7);
            let len  = byte2 & 0b1111111;

            if(ws.msgReader.dataType === 8) //close frame
                return delWSocket(ws);
            
            if(len === 126)
            {
                len = buff.readUInt16BE(ws.msgReader.offset);
                ws.msgReader.offset += 2;
            }
            else if(len === 127)
            {
                len = buff.readBigUInt64BE(ws.msgReader.offset);

                if(len < BigInt(2) ** BigInt(53))
                    len = parseInt(len);

                ws.msgReader.offset += 8;
            }

            if(ws.msgReader.offset + len > buff.length)
                ws.inReadMode = true;
            
            ws.msgReader.len = len;
        }
        else ws.msgReader.offset = 0;
        
//        console.log(ws.msgReader.data.length);
        
        if(ws.msgReader.mask && !ws.msgReader.maskKey && ws.msgReader.offset + 4 <= buff.length)
        {
            ws.msgReader.maskKey = buff.slice(ws.msgReader.offset, ws.msgReader.offset + 4);
            ws.msgReader.offset += 4;
            
            ws.msgReader.readPlayload = true;
        }
        else if(!ws.msgReader.readPlayload && !ws.msgReader.mask)
            ws.msgReader.readPlayload = true;
        
        if(ws.msgReader.readPlayload) process.nextTick(function()
        {
            let toReadBytes = ws.msgReader.len - ws.msgReader.data.length;
            toReadBytes = toReadBytes <= buff.length ? toReadBytes : buff.length;

            let data = buff.slice(ws.msgReader.offset, ws.msgReader.offset + toReadBytes);

            if(ws.msgReader.mask)
            {
                let l = ws.msgReader.data.length;
                for(let i = 0; i < data.length; i++)
                    data[i] = data[i] ^ ws.msgReader.maskKey[(l+i) % 4];
            }

            ws.msgReader.data = Buffer.concat([ws.msgReader.data, data]);

            if(ws.msgReader.data.length === ws.msgReader.len)
            {
                if(ws.msgReader.dataType === 9) //ping
                {
                    sendData(ws, ws.msgReader.data, {opcode: 10});
                    ws.events.emit("ping", ws.msgReader.data, ws);
                }
                else if(ws.msgReader.dataType === 10) //pong
                {
                    ws.isOpen = ws.msgReader.data === ws.pingData;
                    ws.events.emit("pong", ws.msgReader.data, ws);
                }
                else 
                    ws.events.emit("data", ws.msgReader.data, ws);

                ws.inReadMode = false;
                delete ws.msgReader;
            }
        });
        
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
    {
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
    
    if(typeof onConnect === "function")
        wsServer.events.on("connect", onConnect);
    
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
            setImmediate(readData, ws, buff);
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
