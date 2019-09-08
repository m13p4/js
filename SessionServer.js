/**
 * A Session Server.
 * 
 * @version 1.0
 *
 * @author m13p4
 * @copyright Meliantchenkov Pavel
 */

(function()
{
    const VERSION = "1.0.not_tested";
    const CONF = {
        expTime:            1000 * 20,
        sessionKeyLength:   100
    };
    
    const net = require('net');
    
    function getRandomString(len)
    {
        var str = ""; len = len || 16;

        while(str.length < len)
            str += Math.random().toString(36).substr(2);

        var upCaseCnt = Math.round(Math.random() * len);
        
        while(upCaseCnt--)
        {
            let upPos = Math.round(Math.random() * len);
            
            str = str.substring(0, upPos)         + 
                  str.charAt(upPos).toUpperCase() + 
                  str.substring(upPos + 1)        ;
        }

        return str.substr(0, len);
    }
    
    var _sessions = {}, _sockets = [],
    SessionServer = net.createServer(function(socket)
    {
        _sockets.push(socket);
        
        socket.write("node session server v" + VERSION + "\n");
        
        socket.on("data", function(_d)
        {
            try
            {
                let data = JSON.parse(_d.toString("utf8"));
                
                if(data instanceof Array && data.length > 0)
                {
                    let type = data[0] || "";
                    let hash = data[1] || "";
                    let sid  = data[2] || "";
                    
                    let res  = [];
                    
                    if(type === "new" && hash.length > 0)
                    {
                        res.push("new");
                        
                        let expTime = Number.isInteger(sid) && sid > 0 ? sid : CONF.expTime;
                        
                        let newSession = {
                            key:  getRandomString(CONF.sessionKeyLength),
                            hash: hash,
                            exp:  Date.now() + expTime,
                            _exp: expTime
                        };
                        
                        while(_sessions[newSession.key])
                            newSession.key = getRandomString(CONF.sessionKeyLength);
                        
                        _sessions[newSession.key] = newSession;
                        res.push(newSession.key);
                    }
                    else if(type === "check" && hash.length > 0 && sid.length > 0)
                    {
                        res.push("check");
                        
                        let now  = Date.now();
                        let _res = _sessions[sid] 
                                    && _sessions[sid].hash === hash 
                                    && _sessions[sid].exp < now;
                        
                        if(!_res && _sessions[sid])
                        {
                            _sessions[sid] = null;
                            delete _sessions[sid];
                        }
                        else if(_res) _sessions[sid].exp = now + _sessions[sid]._exp;
                        
                        res.push(_res);
                    }
                    else if(type === "close" && hash.length > 0 && sid.length > 0)
                    {
                        res.push("close");
                        
                        if(_sessions[sid])
                        {
                            _sessions[sid] = null;
                            delete _sessions[sid];
                            
                            res.push(true);
                        }
                        else res.push(false);
                    }
                    else if(type === "ping")
                    {
                        res.push("PING");
                    }
                    else
                    {
                        res.push("err");
                        res.push("incomprehensible request");
                        res.push([type, hash, sid]);
                    }
                    
                    res.length > 0 && socket.write(JSON.stringify(res));
                }
                
            } catch(err) { console.log("[" + (new Date()).toLocaleString() + "] SessionServer -> Error:", err); }
        });
        
        socket.on("close", function(data)
        {
            let iof = _sockets.indexOf(socket);
            iof > -1 && _sockets.splice(iof, 1);
        });
    });
    SessionServer.listen(12345);
})();
