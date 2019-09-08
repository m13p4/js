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
        
        defaultKeyLength:   50,
        largestKeyLength:   255, // 0xff
        
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
    
    function checkSession(_sessions, sid, hash, withoutExp)
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
    
    function mergeConf(cnf1, cnf2)
    {
        var cnf = JSON.parse(JSON.stringify(cnf1));
        
        if(cnf2 instanceof Array) 
            for(var i in cnf2) 
                cnf[i] = cnf2[i];
        
        return cnf;
    }
    
    function _run(_CONF, _sessions, _sockets)
    {
        var Server = net.createServer(function(socket)
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

                            let expTime = Number.isInteger(sid) && sid > 0 ? sid : _CONF.expTime;
                            let keyLength = Number.isInteger(data[3]) && data[3] > 0 ? data[3] : _CONF.defaultKeyLength;
                            
                            if(keyLength > _CONF.largestKeyLength) keyLength = _CONF.largestKeyLength;

                            let newSession = {
                                key:  getRandomString(keyLength),
                                hash: hash,
                                exp:  Date.now() + expTime,

                                _exp: expTime,
                                _var: {}
                            };

                            while(_sessions[newSession.key])
                                newSession.key = getRandomString(keyLength);

                            _sessions[newSession.key] = newSession;
                            res.push(newSession.key);
                        }
                        else if(type === "check" && hash.length > 0 && sid.length > 0)
                        {
                            res.push("check");
                            res.push(checkSession(_sessions, sid, hash));
                        }
                        else if(type === "close" && hash.length > 0 && sid.length > 0)
                        {
                            res.push("close");

                            if(checkSession(_sessions, sid, hash, true))
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

                            if(checkSession(_sessions, sid, hash))
                            {
                                let key = 3 in data ? data[3] : null;
                                let val = 4 in data ? data[4] : null;

                                if(typeof key !== "string") key = JSON.stringify(key);

                                _sessions[sid]._var[key] = val;
                                res[1] = true;
                            }
                        }
                        else if(type === "get" && hash.length > 0 && sid.length > 0)
                        {
                            res.push("get");

                            let key = 3 in data ? data[3] : null;
                            let val = null;

                            if(checkSession(_sessions, sid, hash))
                            {
                                if(typeof key !== "string") key = JSON.stringify(key);

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
                } 
                catch(err) { console.log("[" + (new Date()).toLocaleString() + "] SessionServer -> Error:", err); }
            });

            socket.on("close", function(data)
            {
                let iof = _sockets.indexOf(socket);
                iof > -1 && _sockets.splice(iof, 1);
            });
        });
        
        Server.listen(_CONF.PORT);
        
        return Server;
    };
    
    function SessionServer() 
    {
        this.conf = null,
        this.server = null,
        
        this.sessions = {},
        this.sockets = [],
        
        this.run = function(cnf)
        {
            this.conf   = mergeConf(CONF, cnf);
            this.server = _run(this.conf, this.sessions, this.sockets);
        };
        
        this.stop = function()
        {
            if(this.server)
            {
                this.server.close(function(d)
                {
                    console.log("[" + (new Date()).toLocaleString() + "] SessionServer -> stop:", d);
                });
                
                this.server = null;
                this.conf = null;
                this.sessions = {};
                this.sockets = [];
            }
        };
    }
    ___.exports = SessionServer;
    
})(typeof module !== "undefined" ? module : {});
