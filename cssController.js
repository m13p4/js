/**
 * cssController - Manipulation von CSS Eigenschaften über "document.styleSheets"
 *                 keine Iteration über die zu veränderten Elemente nötig.
 *                 Eigenschaften werden an der Klassen-Definition von CSS verändert.
 * 
 * @version 0.3a
 *
 * @author Pavel
 * @copyright Pavel Meliantchenkov
 */

var CSSC = cssController = (function()
{
    var controller = function(styleSheetsDOM, parent, initOnRun)
    {
        //console.log("styleSheetsDOM:");
        //console.log(styleSheetsDOM);
        
        var index = {}, 
            isInit = false, 
            styleSheetsDOM,
            ownStyleElem,
            _this = this;

        var init = function()
        {
            if("cssRules" in styleSheetsDOM)
            {
                indexCssRules(styleSheetsDOM.cssRules);
            }
            else if("length" in styleSheetsDOM)
            {
                for(var i = 0; i < styleSheetsDOM.length; i++)
                {
                    indexCssRules(styleSheetsDOM[i].cssRules);
                }
            }
            
            isInit = true;
        },
        indexCssRules = function(cssRules)
        {
            for(var i = 0; i < cssRules.length; i++)
            {
                if("selectorText" in cssRules[i])
                {
                    addToIndex(cssRules[i]);
                }
                else if("conditionText" in cssRules[i])
                {
                    addConditionToIndex(cssRules[i]);
                }
            }
        },
        addToIndex = function(cssRule)
        {
            if(!!index[cssRule.selectorText])
            {
                index[cssRule.selectorText].content.push(cssRule);
            }
            else
            {
                index[cssRule.selectorText] = {'type':"rule","content":[cssRule]};
            }
        },
        addConditionToIndex = function(condition)
        {
            //if(!!index[condition.conditionText])
            //{
            //    index[condition.conditionText].push(new controller(condition));
            //}
            //else
            //{
                index[condition.conditionText] = {'type':"condition","content":new controller(condition, _this, true)};
            //}
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

            var rulePos = ownStyleElem.sheet.cssRules.length,
                ruleString = "";
            if(Object.prototype.toString.call(property) == "[object Object]")
            {
                for(var key in property)
                {
                    ruleString += key+":"+property[key]+"; ";
                }
            }
            else
            { 
                ruleString = property+":"+value+";";
            }

            if("insertRule" in ownStyleElem.sheet)
            {
                ownStyleElem.sheet.insertRule(selector+"{"+ruleString+"}", rulePos);
            }
            else if("addRule" in ownStyleElem.sheet)
            {
                ownStyleElem.sheet.addRule(selector, ruleString, rulePos);
            }

            addToIndex(ownStyleElem.sheet.cssRules[rulePos]);
        },
        controllerObj = function(elems, selector)
        {
            return {
                'set': function(property, value)
                { 
                    if(elems.length > 0)
                    {
                        //Multi set if property a object with key & value
                        if(Object.prototype.toString.call(property) == "[object Object]")
                        {
                            for(var i = 0; i < elems.length; i++)
                            {
                                for(var key in property)
                                {
                                    elems[i].style[key] = property[key];
                                }
                            }
                        }
                        else //Single set
                        {
                            for(var i = 0; i < elems.length; i++)
                            {
                                elems[i].style[property] = value;
                            }
                        }
                    }
                    else //create new rule
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
                        toReturn = elems[i].style[property];
                    }
                    return toReturn;
                },
                'delete': function(property)
                {
                    for(var i = 0; i < elems.length; i++)
                    {
                        elems[i].style[property] = null;
                    }

                    return this;
                },
                'destroy': function()
                {
                    for(var i = 0; i < elems.length; i++)
                    {
                        elems[i].parentStyleSheet.deleteRule(elems[i]);
                        deleteFromIndex(selector);
                    }
                }
            };
        };
        
        if(initOnRun)
        {
            init();
        }
        
        return function(selector)
        {
            var elems = getFromIndex(selector);
            
            if(elems.type == "condition")
            {
                return elems.content;
            }
            else
            {    
                return controllerObj(elems.content, selector);
            }
        };
    };
    
    return new controller(document.styleSheets, null, false);
})();
