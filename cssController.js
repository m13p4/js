/**
 * cssController - Manipulation von CSS Eigenschaften über "document.styleSheets"
 *                 keine Iteration über die zu veränderten Elemente nötig.
 *                 Eigenschaften werden an der Klassen-Definition von CSS verändert.
 * 
 * @version 0.1a
 *
 * @author Pavel
 * @copyright Pavel Meliantchenkov
 */

var cssController = function()
{
    var index = {}, styleSheetsDOM;
    
    /* Private */
    var init = function()
    {
        styleSheetsDOM = document.styleSheets;
        
        var styleSheetSet, cssRules;
        for(var i = 0; i < styleSheetsDOM.length; i++)
        {
            styleSheetSet = styleSheetsDOM[i];
            
            cssRules = styleSheetSet.cssRules;
            
            for(var j = 0; j < cssRules.length; j++)
            {
                addToIndex(cssRules[j].selectorText, cssRules[j].style);
            }
        }
    },
    addToIndex = function(selector, style)
    {
        if(!!index[selector])
        {
            index[selector].append(style);
        }
        else
        {
            index[selector] = [style];
        }
    },
    getFromIndex = function(selector)
    {
        return !!index[selector] ? index[selector] : [];
    };
    
    /* Public */
    this.change = function(selector, property, value)
    {
        var elems = getFromIndex(selector);
        
        for(var i = 0; i < elems.length; i++)
        {
            elems[i][property] = value;
        }
    };
    
    
    window.addEventListener("load", function()
    {
        init();
        
        //console.log(index);
    });
};
