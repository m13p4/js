/**
 * Get a random string
 *
 * @version 1.0
 * @author m13p4
 */
function getRandomString(len)
{
    var str = "";
    
    while(str.length < (len||16))
        str += Math.random().toString(36).substr(2);
    
    return str.substr(0, (len||16));
}
typeof module != "undefined" && (module.exports = getRandomString);
