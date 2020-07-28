function readBuffer(UInt8Arr, byteLength, mod)
{
    mod = typeof mod === "undefined" ? 1 : mod;

    var i = 0, p, int, res = [],
        useBigInt = byteLength > 4 && typeof BigInt !== "undefined",
        useBinStr = byteLength > 4 && !useBigInt, 
        bitShift  = useBigInt ? BigInt(8) : 8;

    for(; i < UInt8Arr.length; i += byteLength)
    {
        int = useBigInt ? BigInt(0) : useBinStr ? "" : 0;

        for(p = 0; p < byteLength; p++)
            if(useBinStr) int += ("00000000" + UInt8Arr[p+i].toString(2)).substr(-bitShift);
            else int = int << bitShift | (useBigInt ? BigInt(UInt8Arr[p+i]) : UInt8Arr[p+i]);

        res.push(parseInt(int, useBinStr ? 2 : 10) / mod);
    }

    return res;
}
