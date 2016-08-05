/**
 * formatedString - String Formatierung 
 *
 * @version 1.0
 *
 * @author Pavel
 * @copyright Pavel Meliantchenkov
 */
 
var formatedString = function(string)
{
    var orgString = string;
    var options = {};
    
    var encode = function(txt)
    {
        return txt.replace(/[\x26\x0A\x3c\x3e\x22\x27]/g, function(txt) 
        {
            return "&#" + txt.charCodeAt(0) + ";";
        });
    },
    parse = function(encodeString)
    {
        var lastPos = 0, formString = "";
        for(var pos in options)
        {
            if(!!encodeString)
            {
                formString += encode(orgString.substr(lastPos, (pos - lastPos)));
            }
            else
            {
                formString += orgString.substr(lastPos, (pos - lastPos));
            }
        
            for(var i = 0; i < options[pos].length; i++)
            {
                formString += options[pos][i];
            }
            
            lastPos = pos;
        }
        
        if(!!encodeString)
        {
            formString += encode(orgString.substr(lastPos));
        }
        else
        {
            formString += orgString.substr(lastPos);
        }
        
        return formString;
    };
    
    this.addOpt = function(pos, opt)
    {
        if(!options[pos])
        {
            options[pos] = [];
        }
        
        options[pos].push(opt);
    };
    this.getOpts = function()
    {
        return options;
    };
    this.getOrgText = function()
    {
        return orgString;
    };
    this.getFormText = function(encodeString)
    {
        return parse(encodeString);
    };
};
