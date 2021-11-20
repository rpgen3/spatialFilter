export const makeDataReversed = data => {
    const _data = data.slice();
    for(const i of Array(data.length >> 2).keys()) {
        const _i = i << 2;
        Object.assign(_data.subarray(_i, _i + 3), data.subarray(_i, _i + 3).map(v => 255 - v));
    }
    return _data;
};
