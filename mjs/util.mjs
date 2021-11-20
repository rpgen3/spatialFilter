export const toI = (w, x, y) => x + y * w;
export const toXY = (w, i) => {
    const x = i % w,
          y = i / w | 0;
    return [x, y];
};
export const calcAny = ({k, width, height}) => { // 地味に必要な計算
    const _k = k >> 1, // 端の幅
          __k = _k << 1, // 両端の幅
          _width = width + __k, // 外周を埋めた幅
          _height = height + __k; // 外周を埋めた高さ
    return {_k, __k, _width, _height};
};
