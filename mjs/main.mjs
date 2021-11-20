export const linear = ({data, index, kernel, sum}) => {
    for(const [i, v] of index.entries()) {
        const rgb = data.subarray(v, v + 3),
              k = kernel[i];
        for(let i = 0; i < 3; i++) sum[i] += rgb[i] * k;
    }
};
export const linear2 = ({data, index, kernel, sum, _kernel, _sum}) => {
    _sum.fill(0);
    for(const [i, v] of index.entries()) {
        const rgb = data.subarray(v, v + 3),
              k = kernel[i],
              _k = _kernel[i];
        for(let i = 0; i < 3; i++) {
            const v = rgb[i];
            sum[i] += v * k;
            _sum[i] += v * _k;
        }
    }
    for(let i = 0; i < 3; i++) sum[i] = Math.sqrt(sum[i] ** 2 + _sum[i] ** 2);
};
export const nonLinear = ({data, index, kernel, sum, luminance, func}) => {
    const m = new Map;
    for(const [i, v] of index.entries()) {
        const lum = luminance[v >> 2];
        m.set(lum, v);
        kernel[i] = lum;
    }
    const i = m.get(func(kernel));
    Object.assign(sum, data.subarray(i, i + 3));
};
