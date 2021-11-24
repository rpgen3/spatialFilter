export const toI = (w, x, y) => x + y * w;
export const toXY = (w, i) => {
    const x = i % w,
          y = i / w | 0;
    return [x, y];
};
export const toTransposed = arr => {
    const w = Math.sqrt(arr.length),
          _arr = arr.slice();
    for(const [i, v] of arr.entries()) {
        const [x, y] = toXY(w, i);
        _arr[y + x * w] = v;
    }
    return _arr;
};
const kernelPrewitt = [
    -1, 0, 1,
    -1, 0, 1,
    -1, 0, 1
];
const kernelSobel = [
    -1, 0, 1,
    -2, 0, 2,
    -1, 0, 1
];
const kernelSobel5 = [
    -1, -2, 0, 2, 1,
    -4, -8, 0, 8, 4,
    -6, -12, 0,12, 6,
    -4, -8, 0, 8, 4,
    -1, -2, 0, 2, 1
];
export const kernel = {
    'Average 3x3': Array(9).fill('1/9'),
    'Average 5x5': Array(25).fill('1/25'),
    'Average 7x7': Array(49).fill('1/49'),
    'Gaussian 3x3': [
        1, 2, 1,
        2, 4, 2,
        1, 2, 1
    ].map(v => `${v}/16`),
    'Gaussian 5x5': [
        1, 4, 6, 4, 1,
        4, 16, 24, 16, 4,
        6, 24, 36, 24, 6,
        4, 16, 24, 16, 4,
        1, 4, 6, 4, 1
    ].map(v => `${v}/256`),
    'Gaussian 7x7': [
        1, 6, 15, 20, 15, 6, 1,
        6, 36, 90, 120, 90, 36, 6,
        15, 90, 225, 300, 225, 90, 15,
        20, 120, 300, 400, 300, 120, 20,
        15, 90, 225, 300, 225, 90, 15,
        6, 36, 90, 120, 90, 36, 6,
        1, 6, 15, 20, 15, 6, 1
    ].map(v => `${v}/4096`),
    'Roberts x': [
        0, 0, 0,
        0, 1, 0,
        0, 0, -1
    ],
    'Roberts y': [
        0, 0, 0,
        0, 0, 1,
        0, -1, 0
    ],
    'Prewitt x': kernelPrewitt,
    'Prewitt y': toTransposed(kernelPrewitt),
    'Sobel x': kernelSobel,
    'Sobel y': toTransposed(kernelSobel),
    'Sobel x 5x5': kernelSobel5,
    'Sobel y 5x5': toTransposed(kernelSobel5),
    'Laplacian 4': [
        0, 1, 0,
        1, -4, 1,
        0, 1, 0
    ],
    'Laplacian 8': [
        1, 1, 1,
        1, -8, 1,
        1, 1, 1
    ],
    'LoG': [
        0, 0, 1, 0, 0,
        0, 1, 2, 1, 0,
        1, 2, -16, 2, 1,
        0, 1, 2, 1, 0,
        0, 0, 1, 0, 0
    ]
};
const diff = (a, b) => { // 行列の差
    const _a = a.slice();
    for(const i of _a.keys()) _a[i] -= b[i];
    return _a;
};
const a = [
    0, 0, 0,
    0, 1, 0,
    0, 0, 0
];
kernel['Sharpen 4'] = diff(a, kernel['Laplacian 4']);
kernel['Sharpen 8'] = diff(a, kernel['Laplacian 8']);
