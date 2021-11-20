// https://algorithm.joho.info/programming/python/opencv-otsu-thresholding-py/
export const binarizeOtsu = luminance => { // 大津の手法（判別分析法）
    const hist = [...Array(256).fill(0)],
          _hist = hist.slice();
    for(const lum of luminance) hist[lum]++;
    let sum = 0;
    for(const [i, v] of hist.entries()) sum += (_hist[i] = i * v);
    let n1 = 0,
        n2 = luminance.length,
        _1 = 0,
        _2 = sum;
    const s_max = [0, -10];
    for(const [th, v] of hist.entries()) {
        n1 += v; // クラス1とクラス2の画素数を計算
        n2 -= v;
        const _v = _hist[th]; // クラス1とクラス2の画素値の平均を計算
        _1 += _v;
        _2 -= _v;
        const mu1 = n1 ? _1 / n1 : 0,
              mu2 = n2 ? _2 / n2 : 0,
              s = n1 * n2 * (mu1 - mu2) ** 2; // クラス間分散の分子を計算
        if(s > s_max[1]) { // クラス間分散の分子が最大のとき、クラス間分散の分子と閾値を記録
            s_max[0] = th;
            s_max[1] = s;
        }
    }
    return s_max[0]; // クラス間分散が最大のときの閾値を取得
};
