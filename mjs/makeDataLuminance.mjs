const luminance = (r, g, b) => r * 0.298912 + g * 0.586611 + b * 0.114478;
export const makeDataLuminance = data => {
    const _data = new Uint8ClampedArray(data.length >> 2);
    for(const i of _data.keys()) {
        const _i = i << 2;
        _data[i] = luminance(...data.subarray(_i, _i + 3));
    }
    return _data;
};
