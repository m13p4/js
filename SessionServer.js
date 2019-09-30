/* Session Server.
 * 
 * @author Meliantchenkov Pavel
 * @version 1.0
 */
(function(___)
{
    const VERSION = "1.0.not_tested";
    const CONF = {
        expTime:            1000 * 20,
        
        defaultKeyLength:   50,
        largestKeyLength:   255, // 0xff
        
        PORT: 12345,
        MASTER_PORT: 54321,
        
        useInCluster: false
    };
    const _sep = "\t;;\f.?!;;\n";
    
    const cluster = require("cluster");
    const net = require('net');
    const _ = require('./helper.js');
    
    const isClusterMaster = cluster.isMaster;
    
    
    function checkSession(_sessions, sid, hash, withoutExp)
    {
        let now = Date.now();
        let res = _sessions[sid] 
                    && _sessions[sid].hash === hash
                    && (!withoutExp || _sessions[sid].exp < now);

        if(!res && _sessions[sid])
        {
            _sessions[sid] = null;
            delete _sessions[sid];
        }
        else if(res && !withoutExp) 
            _sessions[sid].exp = now + _sessions[sid]._exp;
        
        return res;
    }
    
    //@todo: implement worker handling
    async function handleMessage(_CONF, _sessions, socket, dataArr, isWorker)
    {
        for(let i = 0; i < dataArr.length; i++)
        {
            let data = dataArr[i].trim();

            if(data.length > 0)
            {
                try
                {
                    data = JSON.parse(data);

                    if(data instanceof Array && data.length > 0)
                    {
                        let id   = data[0];
                        let type = data[1] || "";
                        let hash = data[2] || "";
                        let sess = data[3] || "";

                        let res  = [id];

                        if(type === "new" && hash.length > 0)
                        {
                            res.push("new");

                            let expTime   = Number.isInteger(sess) && sess > 0 ? sess : _CONF.expTime;
                            let keyLength = Number.isInteger(data[4]) && data[4] > 0 ? data[4] : _CONF.defaultKeyLength;
                            let base; if(Number.isInteger(data[5])) base = data[5];

                            if(keyLength > _CONF.largestKeyLength) keyLength = _CONF.largestKeyLength;

                            let newSession = {
                                key:  _.getRandomString(keyLength, base),
                                hash: hash,
                                exp:  Date.now() + expTime,

                                _exp: expTime,
                                _var: {}
                            };

                            while(_sessions[newSession.key])
                                newSession.key = _.getRandomString(keyLength, base);

                            _sessions[newSession.key] = newSession;
                            res.push(newSession.key);
                        }
                        else if(type === "check" && hash.length > 0 && sess.length > 0)
                        {
                            res.push("check");
                            res.push(checkSession(_sessions, sess, hash));
                        }
                        else if(type === "close" && hash.length > 0 && sess.length > 0)
                        {
                            res.push("close");

                            if(checkSession(_sessions, sess, hash, true))
                            {
                                _sessions[sess] = null;
                                delete _sessions[sess];

                                res.push(true);
                            }
                            else res.push(false);
                        }
                        else if(type === "set" && hash.length > 0 && sess.length > 0)
                        {
                            res.push("set");
                            res.push(false);

                            if(checkSession(_sessions, sess, hash))
                            {
                                let key = 4 in data ? data[4] : null;
                                let val = 5 in data ? data[5] : null;

                                if(typeof key !== "string") key = JSON.stringify(key);

                                _sessions[sess]._var[key] = val;
                                res[2] = true;
                            }
                        }
                        else if(type === "get" && hash.length > 0 && sess.length > 0)
                        {
                            res.push("get");

                            let key = 4 in data ? data[4] : null;
                            let val = null;

                            if(checkSession(_sessions, sess, hash))
                            {
                                if(typeof key !== "string") key = JSON.stringify(key);

                                if(key && _sessions[sess]._var[key])
                                    val = _sessions[sess]._var[key];
                            }

                            res.push(key);
                            res.push(val);
                        }
                        else if(type === "ping") res.push("PING");
                        else
                        {
                            res.push("err");
                            res.push("incomprehensible request");
                            res.push(data);
                        }

                        res.length > 0 && socket.write(JSON.stringify(res)+_sep);
                    }
                }
                catch(e){ /* empty */ }
            }
        }
    }
    
    function _run(_CONF, _sessions, _sockets, isWorker)
    {
        var Server = net.createServer(function(socket)
        {
            var dataStr = "";
            
            _sockets.push(socket);

            //socket.write(JSON.stringify("session server v" + VERSION) + _sep);

            socket.on("data", function(_d)
            {
                try
                {
                    let chunk = _d.toString("utf8");
                    
                    dataStr += chunk;
                    
                    if(dataStr.indexOf(_sep) > -1)
                    {
                        let dataArr = dataStr.split(_sep);
                        dataStr = dataArr.pop();
                        
                        handleMessage(_CONF, _sessions, socket, dataArr, isWorker);
                    }
                }
                catch(e) { /* empty */ }
            });

            socket.on("close", function(data)
            {
                let iof = _sockets.indexOf(socket);
                iof > -1 && _sockets.splice(iof, 1);
            });
            
            socket.on("error", function(err)
            {
                console.log(err);
            });
        });
        
        let clbk = function()
        {
            console.log("[" + (new Date()).toLocaleString() + "] SessionServer"
                            + (isWorker ? " Worker":"")+" runs on port "
                            + (_CONF.useInCluster && isClusterMaster ? _CONF.MASTER_PORT : _CONF.PORT)
                       );
        };
        
        if(_CONF.useInCluster && isClusterMaster)
            Server.listen(_CONF.MASTER_PORT, "127.0.0.1", clbk);
        else
            Server.listen(_CONF.PORT, clbk);
        
        return Server;
    };
    
    function SessionServer() 
    {
        var intervalID;
        
        this.conf = null;
        this.server = null;
        
        this.sessions = {};
        this.sockets = [];
        
        this.socket = null;
        this.isWorker = false;
        
        this.run = function(cnf)
        {
            this.conf = _.mergeConf(CONF, cnf);
            
            if(isClusterMaster || !this.conf.useInCluster)
            {
                this.server = _run(this.conf, this.sessions, this.sockets);

                var _this = this;
                intervalID = setInterval(function()
                {
                    let now  = Date.now();

                    for(let key in _this.sessions)
                        if(_this.sessions[key].exp < now)
                        {
                            _this.sessions[key] = null;
                            delete _this.sessions[key];
                        }

                }, 1000 * 10);
            }
            else if(this.conf.useInCluster)
            {
                this.isWorker = true;
                this.server = _run(this.conf, this.sessions, this.sockets, true);
                
                this.socket = new net.Socket();
            
                this.socket.connect(this.conf.MASTER_PORT, "127.0.0.1", function() 
                {
                    console.log("[" + (new Date()).toLocaleString() + "] SessionServer Worker -> connected to SessionServer Master");
                });
            }
            
            //console.log(isClusterMaster);
        };
        
        this.stop = function()
        {
            intervalID && clearInterval(intervalID);
            
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
