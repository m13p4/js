/**
 * get CPU Info
 * 
 * @version 1.0
 *
 * @author m13p4
 * @copyright Meliantchenkov Pavel
 */
const OS = require("os");

module.exports = function(callback, timeOutMS)
{
    if(!callback || !OS) return;
    
    function _getCPUInfo()
    {
        var cpuInfo = OS.cpus(), i = 0, 
            res = {
                    sum: {
                        user: 0,
                        nice: 0,
                        sys: 0,
                        idle: 0,
                        irq: 0,
                        total: 0
                    }, 
                    length: cpuInfo.length
                };

        for(; i < cpuInfo.length; i++)
        {
            res[i] = Object.assign({model: cpuInfo[i].model, speed: cpuInfo[i].speed}, cpuInfo[i].times, {
                        total: cpuInfo[i].times.user +
                               cpuInfo[i].times.nice + 
                               cpuInfo[i].times.sys + 
                               cpuInfo[i].times.idle + 
                               cpuInfo[i].times.irq
                        });
            
            res.sum.user += cpuInfo[i].times.user;
            res.sum.nice += cpuInfo[i].times.nice;
            res.sum.sys += cpuInfo[i].times.sys;
            res.sum.idle += cpuInfo[i].times.idle;
            res.sum.irq += cpuInfo[i].times.irq;
            
            res.sum.total += res[i].total;
        }
              
       return res;
    }
    
    var res1 = _getCPUInfo();
    setTimeout(function()
    {
        var res2 = _getCPUInfo(), i = 0, 
            res = {
                sum: {
                    user: res2.sum.user - res1.sum.user,
                    nice: res2.sum.nice - res1.sum.nice,
                    sys: res2.sum.sys - res1.sum.sys,
                    idle: res2.sum.idle - res1.sum.idle,
                    irq: res2.sum.irq - res1.sum.irq,
                    total: res2.sum.total - res1.sum.total,
                    
                    free: 0, inUse:0
                },
                length: res1.length
            };
        
        res.sum.free = res.sum.idle / res.sum.total;
        res.sum.inUse = 1 - res.sum.free;
            
        for(; i < res1.length; i++)
        {
            res[i] = {
                model: res1[i].model,
                speed: res1[i].speed,
                
                user: res2[i].user - res1[i].user,
                nice: res2[i].nice - res1[i].nice,
                sys: res2[i].sys - res1[i].sys,
                idle: res2[i].idle - res1[i].idle,
                irq: res2[i].irq - res1[i].irq,
                total: res2[i].total - res1[i].total,
                
                free: 0, inUse:0
            };
            
            res[i].free = res[i].idle / res[i].total;
            res[i].inUse = 1 - res[i].free;
        }
        
        callback(res);
        
    }, timeOutMS || 1000);
}
