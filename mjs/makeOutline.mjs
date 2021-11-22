import {toI, toXY, calcAny} from 'https://rpgen3.github.io/spatialFilter/mjs/util.mjs';
export const makeOutline = ({data, width, height, k, outline = 0}) => {
    const {_k, __k, _width, _height} = calcAny({k, width, height}),
          _data = new Uint8ClampedArray(_width * _height << 2);
    for(const i of Array(width * height).keys()) {
        const [x, y] = toXY(width, i),
              a = i << 2,
              b = (x + _k) + (y + _k) * _width << 2;
        Object.assign(_data.subarray(b, b + 3), data.subarray(a, a + 3));
    }
    if(outline === 2) return _data; // 外周は黒
    const _toI = (x, y) => toI(_width, x, y),
          _toXY = i => toXY(_k, i);
    const put = (a, b) => {
        const _a = a << 2,
              _b = b << 2;
        Object.assign(_data.subarray(_a, _a + 3), _data.subarray(_b, _b + 3));
    };
    { // 四隅
        const w = _k + width,
              h = _k + height;
        for(const [[ax, ay], [bx, by]] of [ // 外周の起点座標, 内周の四隅
            [[0, 0], [_k, _k]], // 左上
            [[w, 0], [-1, _k]], // 右上
            [[0, h], [_k, -1]], // 左下
            [[w, h], [-1, -1]] // 右下
        ]) {
            const len = _k ** 2;
            for(const i of Array(len).keys()) {
                const [x, y] = _toXY(i);
                const _i = outline ? _toI(ax + bx, ay + by) : (() => {
                    const [cx, cy] = [bx, by].map(v => v - _k + 1), // 外周の対称の起点
                          [x, y] = _toXY(len - i - 1);
                    return _toI(x + ax + bx + cx, y + ay + by + cy);
                })();
                put(_toI(x + ax, y + ay), _i);
            }
        }
    }
    { // 上下
        const kh = _k + height - 1;
        for(const x of Array(width).keys()) {
            const kx = _k + x;
            for(const a of Array(_k).keys()) {
                const a1 = a + 1,
                      o = outline ? 0 : a1;
                put(_toI(kx, _k - a1), _toI(kx, _k + o));
                put(_toI(kx, kh + a1), _toI(kx, kh - o));
            }
        }
    }
    { // 左右
        const kw = _k + width - 1;
        for(const y of Array(height).keys()) {
            const ky = _k + y;
            for(const a of Array(_k).keys()) {
                const a1 = a + 1,
                      o = outline ? 0 : a1;
                put(_toI(_k - a1, ky), _toI(_k + o, ky));
                put(_toI(kw + a1, ky), _toI(kw - o, ky));
            }
        }
    }
    return _data;
};
