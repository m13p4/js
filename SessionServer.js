/**
 * A Session Server.
 * 
 * @version 1.0
 *
 * @author m13p4
 * @copyright Meliantchenkov Pavel
 */

(function(___)
{
    const VERSION = "1.0.not_tested";
    const CONF = {
        expTime:            1000 * 20,
        sessionKeyLength:   100,
        
        PORT: 12345
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
    
    var _sessions = {}, _sockets = [];
    
    function checkSession(sid, hash, withoutExp)
    {
        let now  = Date.now();
        let res = _sessions[sid] 
                    && _sessions[sid].hash === hash
                    && (withoutExp || _sessions[sid].exp < now);

        if(!res && _sessions[sid])
        {
            _sessions[sid] = null;
            delete _sessions[sid];
        }
        else if(res && !withoutExp) 
            _sessions[sid].exp = now + _sessions[sid]._exp;
        
        return res;
    }
    
    var SessionServer = net.createServer(function(socket)
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
                            
                            _exp: expTime,
                            _var: {}
                        };
                        
                        while(_sessions[newSession.key])
                            newSession.key = getRandomString(CONF.sessionKeyLength);
                        
                        _sessions[newSession.key] = newSession;
                        res.push(newSession.key);
                    }
                    else if(type === "check" && hash.length > 0 && sid.length > 0)
                    {
                        res.push("check");
                        res.push(checkSession(sid, hash));
                    }
                    else if(type === "close" && hash.length > 0 && sid.length > 0)
                    {
                        res.push("close");
                        
                        if(checkSession(sid, hash, true))
                        {
                            _sessions[sid] = null;
                            delete _sessions[sid];
                            
                            res.push(true);
                        }
                        else res.push(false);
                    }
                    else if(type === "set" && hash.length > 0 && sid.length > 0)
                    {
                        res.push("set");
                        res.push(false);
                        
                        if(checkSession(sid, hash))
                        {
                            let key = data[3];
                            let val = data[4];
                            
                            if(key && val)
                            {
                                _sessions[sid]._var[key] = val;
                                res[1] = true;
                            }
                        }
                    }
                    else if(type === "get" && hash.length > 0 && sid.length > 0)
                    {
                        res.push("get");
                        
                        let key = null;
                        let val = null;
                        
                        if(checkSession(sid, hash))
                        {
                            key = data[3];
                            
                            if(key && _sessions[sid]._var[key])
                                val = _sessions[sid]._var[key];
                        }
                        
                        res.push(key);
                        res.push(val);
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
    SessionServer.listen(CONF.PORT);
    
    ___.exports = SessionServer;
    
})(typeof module !== "undefined" ? module : {});
