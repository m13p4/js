/**
 * Random string 
 * 
 * @version 1.0
 * @author m13p4
 */
function getRandomString(length)
{
    length = length || 16;
    
    var str = "";
    
    while(str.length < length)
        str += Math.random().toString(36).substr(2);
    
    return str.substr(0, length);
}
