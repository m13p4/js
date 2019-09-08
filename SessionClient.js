/**
 * A Client for a Session Server.
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
        HOST: "127.0.0.1",
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
    
    function mergeConf(cnf1, cnf2)
    {
        var cnf = JSON.parse(JSON.stringify(cnf1));
        
        if(cnf2 instanceof Array) 
            for(var i in cnf2) 
                cnf[i] = cnf2[i];
        
        return cnf;
    }
    
    function emptyCallback(){ /* empty */ }
    
    function SessionClient() 
    {
        var list = {};
        
        this.conf = null;
        this.client = null;
        
        this.connect = function(conf)
        {
            this.conf = mergeConf(CONF, conf);
            
            this.client = new net.Socket();
            
            this.client.connect(this.conf.PORT, this.conf.HOST, function() 
            {
                console.log("[" + (new Date()).toLocaleString() + "] SessionClient -> connected to " + this.conf.HOST + ":" + this.conf.PORT);
            });
            
            this.client.on('data', function(_d) 
            {
                let data  = JSON.parse(_d);
                let type  = data[0] || ":";
                let tSpl  = type.split(":");
                let id    = tSpl[1] ? (":" + tSpl[1]) : "";
                
                let callback = id && list[id];
                
                type = tSpl[0] || "";
                
                if(callback)
                {
                    if(type === "get")       callback(false, data[1], data[2]);
                    else if(type === "ping") callback(false);
                    else if(type === "err")  callback({
                        message: data[1],
                        req: data[2]
                    });
                    else callback(false, data[1]);
                
                    list[id] = null;
                    delete list[id];
                }
            });
        };
        
        this.new = function(callback, hash, exp, length)
        {
            let id  = getRandomString();
            let req = ["new:"+id, hash];
            
            exp && req.push(exp);
            length && req.push(length);
            
            list[id] = callback || emptyCallback;
            
            this.client.write(JSON.stringify(req));
        };
        
        this.check = function(callback, hash, sid)
        {
            let id  = getRandomString();
            let req = ["check:"+id, hash, sid];
            
            list[id] = callback || emptyCallback;
            
            this.client.write(JSON.stringify(req));
        };
        
        this.close = function(callback, hash, sid)
        {
            //@todo: implement
        };
        
        this.set = function(callback, hash, sid, key, val)
        {
            //@todo: implement
        };
        
        this.get = function(callback, hash, sid, key)
        {
            //@todo: implement
        };
        
        this.ping = function(callback)
        {
            //@todo: implement
        };
    };
    ___.exports = SessionClient;
    
})(typeof module !== "undefined" ? module : {});
