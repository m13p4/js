/**
 * Random string 
 * 
 * @version 1.0
 * @author m13p4
 */
function getRandomString(length)
{
    var str = "";
    
    while(str.length < (length||16))
        str += Math.random().toString(36).substr(2);
    
    return str.substr(0, length);
}
typeof module !== "undefined" && (module.exports = getRandomString);
