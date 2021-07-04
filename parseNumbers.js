/**
 * extendet js functions Number.toString, parseInt and parseFloat
 * 
 * @version 1.0
 * @author m13p4
 * @copyright Meliantchenkov Pavel
 * @license MIT
 */
(function()
{ 'use strict';

    var _parseInt = parseInt, _parseFloat = parseFloat, _toString = Number.prototype.toString;

    Number.prototype._strNums  = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    Number.prototype.toString  = function(radix, strNums)
    {
        if(typeof radix === "undefined")
        {
            if(typeof strNums === "undefined")
                return "" + this;
            
            radix = 10;
        }
        
        strNums = strNums || this._strNums;
        
        if(!(strNums instanceof Array))
        {
            if(typeof strNums !== "string")
                throw new TypeError("strNums must be an array or string, \"" + (typeof strNums) + "\" given");
            
            strNums = strNums.split("");
        }
        
        if(!Number.isInteger(radix) || radix < 2 || radix > strNums.length)
            throw new RangeError("radix must be an integer at least 2 and no greater than " + strNums.length);
        
        var negative = this < 0, int = negative ? -this : this + 0, float = int % 1,
        calc = function(num)
        {
            var res = "";
            
            if(num === 0) return strNums[0];
            
            while(num > 0)
            {
                res = strNums[num % radix] + res;
                num = Math.floor(num / radix);
            }
            return res;
        };
        
        if(float !== 0)
        {
            int = parseInt(int);
            
            while(float % 1 !== 0)
                float *= radix;
            
            float = Math.floor(float);
        }
        
        return (negative ? "-" : "") + calc(int) + (float > 0 ? "." + calc(float).replace(new RegExp(strNums[0]+"+$"), "") : "");
    };
    Number.prototype.toStringOriginal = _toString;
    
    parseInt = function(strInt, radix, strNums)
    {
        if(typeof radix === "undefined")
        {
            if(typeof strNums === "undefined")
                return _parseInt(strInt * 1);
            
            radix = 10;
        }
        if(radix < 37 && typeof strNums === "undefined") 
            strInt = strInt.toLowerCase();

        strNums = strNums || Number.prototype._strNums;
        
        if(!(strNums instanceof Array))
        {
            if(typeof strNums !== "string")
                throw new TypeError("strNums must be an array or string, \"" + (typeof strNums) + "\" given");
            
            strNums = strNums.split("");
        }

        if(!Number.isInteger(radix) || radix < 2 || radix > strNums.length)
            throw new RangeError("radix must be an integer at least 2 and no greater than " + strNums.length);

        strInt = strInt.split(".")[0].split("");

        if(strNums.indexOf(strInt[0]) < 0)
            return NaN;

        var i = 0, res = 0, add;
        for(; i < strInt.length; i++)
        {
            add = strNums.indexOf(strInt[i]);
            if(add < 0) break;

            res = res * radix + add;
        }
        return res;
    };
    parseInt.original = _parseInt;
    Number._parseInt  = Number.parseInt;
    Number.parseInt   = parseInt;

    parseFloat = function(strFloat, radix, strNums)
    {
        strNums = strNums || Number.prototype._strNums;

        var split = strFloat.split("."), 
            int = split[0], float = split[1] || strNums[0],

            intInt   = parseInt(int, radix, strNums),
            intFloat = parseInt(float, radix, strNums);

        return intFloat / radix ** float.length + intInt;
    };
    parseFloat.original = _parseFloat;
    Number._parseFloat  = Number.parseFloat;
    Number.parseFloat   = parseFloat;
})();
