/**
 * cssController - Manipulation von CSS Eigenschaften über "document.styleSheets"
 *                 keine Iteration über die zu veränderten Elemente nötig.
 *                 Eigenschaften werden an der Klassen-Definition von CSS verändert.
 * 
 * @version 0.2a
 *
 * @author Pavel
 * @copyright Pavel Meliantchenkov
 */

var CSSC = cssController = (function()
{
    var index = {}, 
        isInit = false, 
        styleSheetsDOM,
        ownStyleElem;
    
    var init = function()
    {
        styleSheetsDOM = document.styleSheets;
        
        for(var i = 0; i < styleSheetsDOM.length; i++)
        {
            indexCssRules(styleSheetsDOM[i].cssRules);
        }
        
        isInit = true;
    },
    indexCssRules = function(cssRules)
    {
        for(var i = 0; i < cssRules.length; i++)
        {
            addToIndex(cssRules[i].selectorText, cssRules[i].style);
        }
    },
    addToIndex = function(selector, styleElem)
    {
        if(!!index[selector])
        {
            index[selector].push(styleElem);
        }
        else
        {
            index[selector] = [styleElem];
        }
    },
    getFromIndex = function(selector)
    {
        if(!isInit) init();
        
        return !!index[selector] ? index[selector] : [];
    },
    deleteFromIndex = function(selector)
    {
        if(!!index[selector])
        {
            delete index[selector];
        }
    },
    createNewStyleElem = function()
    {
        var styleElem = document.createElement("style");
        styleElem.setAttribute("type", "text/css");
        styleElem.setAttribute("id", "cssc-container");
        styleElem.appendChild(document.createTextNode(""));
        
        document.head.appendChild(styleElem);
        
        ownStyleElem = styleElem;
    },
    addNewRule = function(selector, property, value)
    {
        if(!ownStyleElem)
        {
            createNewStyleElem();
        }
        
        var rulePos = ownStyleElem.sheet.cssRules.length;
        ownStyleElem.sheet.insertRule(selector+"{"+property+":"+value+";}", rulePos);
        
        addToIndex(selector, ownStyleElem.sheet.cssRules[rulePos].style);
    },
    controllerObj = function(elems, selector)
    {
        return {
            'set': function(property, value)
            {
                if(elems.length > 0)
                {
                    for(var i = 0; i < elems.length; i++)
                    {
                        elems[i][property] = value;
                    }
                }
                else
                {
                    addNewRule(selector, property, value);
                    elems = getFromIndex(selector);
                }
                
                return this;
            },
            'get': function(property)
            {
                var toReturn = "";
                for(var i = 0; i < elems.length; i++)
                {
                    toReturn = elems[i][property];
                }
                return toReturn;
            },
            'delete': function(property)
            {
                for(var i = 0; i < elems.length; i++)
                {
                    elems[i][property] = null;
                }
                
                return this;
            },
            'destroy': function()
            {
                for(var i = 0; i < elems.length; i++)
                {
                    elems[i].parentRule.parentStyleSheet.deleteRule(elems[i].parentRule);
                    deleteFromIndex(selector);
                }
            }
        };
    };
    
    return function(selector)
    {
        var elems = getFromIndex(selector);
        return controllerObj(elems, selector); 
    };
})();
