/**
 * RegEx Matcher mit Positionsangabe
 * 
 * @version 1.0
 *
 * @author m13p4
 * @copyright Pavel Meliantchenkov
 */

var RegExpGrpPos = function(regexp, posabsolute)
{
    var myRegExp = regexp,
        matchStr = null,
        grpPosInfo = null,
        posAbsoluete = !!posabsolute;
    
    var groupFinder = function()
    {
        var regex = myRegExp.toString();

        //console.log(regex);
        var groupPos = [],
            grp = [],
            cnt = 0, 
            chr,
            toCount = false;

        for (var i = 0; i < regex.length; i++)
        {
            chr = regex[i];

            if (chr === '(' && regex[i - 1] !== "\\")
            {
                //console.log("Pos +: " + i);
                cnt++;

                groupPos.push([cnt, i]);
                
            }
            else if (chr === ')' && regex[i - 1] !== "\\")
            {
                //console.log("Pos -: " + i);
                cnt--;
            }
            else if ((chr === '(' || chr === ')') && regex[i - 1] === "\\")
            {
                toCount = false;

                for (var j = i - 2; j > -1; j--)
                {
                    if (regex[j] === "\\")
                        toCount = !toCount;
                    else
                        break;
                }

                if (toCount && chr === '(')
                {
                    cnt++;

                    groupPos.push([cnt, i]);

                    
                    //console.log("Pos/ +: " + i);
                }
                else if (toCount && chr === ')')
                {
                    cnt--;
                    //console.log("Pos/ -: " + i);
                }
            }
            
            //hier
        }

        //cnt muss am ende wieder 0 sein, wenn nicht ist bei der berechnung etwas schief gegangen
        return (cnt === 0 ? groupPos : false);
    },
    findPositions = function(matches)
    {
        var m = [], tmpIndex = 0, foundIndex = matches.index, posM1, posM2;

        m[0] = [matches[0], (!!posAbsoluete ? foundIndex : tmpIndex)];

        for (var i = 1; i < matches.length; i++)
        {
            posM1 = (!!grpPosInfo[i - 1]) ? grpPosInfo[i - 1][0] : 0;
            posM2 = (!!grpPosInfo[i - 2]) ? grpPosInfo[i - 2][0] : 0;
            
            if (posM1 > posM2)
            {
                tmpIndex = (!!posAbsoluete ? (m[i - 1][1] - foundIndex) : m[i - 1][1]); //;

            }
            else if(posM1 < posM2)
            {
                tmpIndex = (!!posAbsoluete ? ((m[i - 1][1] + m[i - 1][0].length) - foundIndex) : (m[i - 1][1] + m[i - 1][0].length));
            }

            if (!!matches[i])
            {
                tmpIndex = matches[0].indexOf(matches[i], tmpIndex);

                m[i] = [matches[i], (!!posAbsoluete ? (tmpIndex + foundIndex) : tmpIndex)];

                tmpIndex += matches[i].length;
            }
            else
            {
                m[i] = ["", (!!posAbsoluete ? (tmpIndex + foundIndex) : tmpIndex)];
            }
        }
        
        return m;
    };
    
    this.match = function(str)
    {
        matchStr = str;
        grpPosInfo = groupFinder();
        
        var matches, 
            lastIndex = null,
            retrn = [];

        while((matches = myRegExp.exec(str)) !== null && lastIndex !== matches.index)
        {
            retrn.push(findPositions(matches));

            lastIndex = matches.index;
        }
        
        return retrn;
    };
    this.setPositionAbsolute = function(posabsulute)
    {
        posAbsoluete = !!posabsulute;
    };
}; 
