(async () => {
    const {importAll, getScript, importAllSettled} = await import(`https://rpgen3.github.io/mylib/export/import.mjs`);
    await getScript('https://code.jquery.com/jquery-3.3.1.min.js');
    const $ = window.$;
    const html = $('body').empty().css({
        'text-align': 'center',
        padding: '1em',
        'user-select': 'none'
    });
    const head = $('<dl>').appendTo(html),
          body = $('<dl>').appendTo(html),
          foot = $('<dl>').appendTo(html);
    const rpgen3 = await importAll([
        'input',
        'css',
        'url',
        'hankaku',
        'sample'
    ].map(v => `https://rpgen3.github.io/mylib/export/${v}.mjs`));
    Promise.all([
        'table',
        'kernel',
        'tab',
        'img'
    ].map(v => `css/${v}.css`).map(rpgen3.addCSS));
    const addBtn = (h, ttl, func) => $('<button>').appendTo(h).text(ttl).on('click', func);
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    $('<div>').appendTo(head).text('空間フィルタリングのテスト');
    $('<div>').appendTo(head).text('処理する画像の設定');
    const makeLoadFunc = ctor => url => new Promise((resolve, reject) => Object.assign(new ctor, {
        onload: ({target}) => resolve(target),
        onloadedmetadata: ({target}) => resolve(target),
        onerror: reject,
        crossOrigin: 'anonymous',
        src: url
    }));
    const image = new class {
        constructor(){
            this.config = $('<div>').appendTo(head);
            this.html = $('<div>').appendTo(head);
            this._load = makeLoadFunc(Image);
            this.img = null;
        }
        async load(url){
            $(this.img = await this._load(url)).appendTo(this.html.empty());
        }
    };
    { // 画像入力
        const selectImg = rpgen3.addSelect(image.config, {
            label: 'サンプル画像',
            save: true,
            list: {
                'レナ': 'Lenna.png',
                'アニメ風レナ': 'Lena_all.png',
                'マンドリル': 'Mandrill.png'
            }
        });
        selectImg.elm.on('change', () => {
            image.load(`img/${selectImg()}`);
        });
        const inputURL = rpgen3.addInputStr(image.config, {
            label: '外部URL',
            save: true
        });
        inputURL.elm.on('change', () => {
            const urls = rpgen3.findURL(inputURL());
            if(urls.length) image.load(urls[0]);
        });
        (rpgen3.findURL(inputURL()).length ? inputURL : selectImg).elm.trigger('change');
        $('<input>').appendTo(image.config).prop({
            type: 'file'
        }).on('change', ({target}) => {
            const {files} = target;
            if(files.length) image.load(URL.createObjectURL(files[0]));
        });
    }
    const nonLinear = new class {
        constructor(){
            this.config = $('<div>').appendTo(body);
            this.html = $('<div>').appendTo(body);
        }
    };
    const toI = (w, x, y) => x + y * w;
    const toXY = (w, i) => {
        const x = i % w,
              y = i / w | 0;
        return [x, y];
    };
    const kernel = new class {
        constructor(){
            this.select = $('<div>').appendTo(body);
            this.config = $('<div>').appendTo(body);
            this.html = $('<table>').appendTo(body);
            this.foot = $('<div>').appendTo(body);
            this.k = 0;
            this.list = [];
            this.tdMap = new Map;
            this.valueMap = new Map;
        }
        resize(k){
            const _k = k - this.k >> 1,
                  list = [];
            this.html.empty();
            this.tdMap.clear();
            this.valueMap.clear();
            for(const y of Array(k).keys()) {
                const tr = $('<tr>').appendTo(this.html);
                for(const x of Array(k).keys()) {
                    const [_x, _y] = [x, y].map(v => v - _k),
                          n = _x < 0 || _x >= this.k || _y < 0 || _y >= this.k ? 0 : this.list[toI(this.k, _x, _y)] || 0;
                    list.push(n);
                    const i = toI(k, x, y);
                    const td = $('<td>').appendTo(tr).prop({
                        contenteditable: true
                    }).text(n).on('focusout', () => {
                        this.input(i, rpgen3.toHan(td.text()));
                    }).addClass(`kernel${Math.max(...[x, y].map(v => v - (k >> 1)).map(Math.abs))}`);
                    this.tdMap.set(i, td);
                    this.valueMap.set(i, n);
                }
            }
            this.k = k;
            this.list = list;
        }
        input(i, value){
            const td = this.tdMap.get(i);
            try {
                const n = Number(new Function(`return ${value}`)());
                if(!Number.isNaN(n)) {
                    this.list[i] = n;
                    td.text(value);
                    this.valueMap.set(i, value);
                }
            }
            catch {}
            td.text(this.valueMap.get(i));
        }
    };
    const inputKernelSize = rpgen3.addInputNum(kernel.config, {
        label: 'カーネルサイズ[n×n]',
        save: true,
        value: 3,
        min: 3,
        max: 23,
        step: 2
    });
    inputKernelSize.elm.on('change', () => {
        kernel.resize(inputKernelSize());
    }).trigger('change');
    const toTransposed = arr => { // 正方の転置行列
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
    const selectLinear = rpgen3.addSelect(kernel.select, {
        label: '線形フィルタ',
        save: true,
        list: {
            '平均値フィルタ(3x3)': Array(9).fill('1/9'),
            '平均値フィルタ(5x5)': Array(25).fill('1/25'),
            '平均値フィルタ(7x7)': Array(49).fill('1/49'),
            'ガウシアンフィルタ(3x3)': [
                1, 2, 1,
                2, 4, 2,
                1, 2, 1
            ].map(v => `${v}/16`),
            'ガウシアンフィルタ(5x5)': [
                1, 4, 6, 4, 1,
                4, 16, 24, 16, 4,
                6, 24, 36, 24, 6,
                4, 16, 24, 16, 4,
                1, 4, 6, 4, 1
            ].map(v => `${v}/256`),
            'ガウシアンフィルタ(7x7)': [
                1, 6, 15, 20, 15, 6, 1,
                6, 36, 90, 120, 90, 36, 6,
                15, 90, 225, 300, 225, 90, 15,
                20, 120, 300, 400, 300, 120, 20,
                15, 90, 225, 300, 225, 90, 15,
                6, 36, 90, 120, 90, 36, 6,
                1, 6, 15, 20, 15, 6, 1
            ].map(v => `${v}/4096`),
            'Robertsフィルタ(x方向)': [
                0, 0, 0,
                0, 1, 0,
                0, 0, -1
            ],
            'Robertsフィルタ(y方向)': [
                0, 0, 0,
                0, 0, 1,
                0, -1, 0
            ],
            'Prewittフィルタ(x方向)': kernelPrewitt,
            'Prewittフィルタ(y方向)': toTransposed(kernelPrewitt),
            'Sobelフィルタ(x方向)': kernelSobel,
            'Sobelフィルタ(y方向)': toTransposed(kernelSobel),
            'Sobelフィルタ(x方向)(5x5)': kernelSobel5,
            'Sobelフィルタ(y方向)(5x5)': toTransposed(kernelSobel5),
            'ラプラシアンフィルタ(4近傍)': [
                0, 1, 0,
                1, -4, 1,
                0, 1, 0
            ],
            'ラプラシアンフィルタ(8近傍)': [
                1, 1, 1,
                1, -8, 1,
                1, 1, 1
            ],
            '鮮鋭化フィルタ': [
                0, -1, 0,
                -1, 5, -1,
                0, -1, 0
            ],
            'LoGフィルタ': [
                0, 0, 1, 0, 0,
                0, 1, 2, 1, 0,
                1, 2, -16, 2, 1,
                0, 1, 2, 1, 0,
                0, 0, 1, 0, 0
            ]
        }
    });
    selectLinear.elm.on('change', () => {
        const k = selectLinear();
        inputKernelSize(Math.sqrt(k.length));
        inputKernelSize.elm.trigger('change');
        for(const [i, v] of k.entries()) kernel.input(i, v);
    }).trigger('change');
    const isNonLinear = rpgen3.addInputBool(nonLinear.config, {
        label: '非線形フィルタを使う',
        save: true
    });
    const selectNonLinear = rpgen3.addSelect(nonLinear.html, {
        label: '非線形フィルタ',
        save: true,
        list: {
            '中央値フィルタ': 0,
            '最小値フィルタ': 1,
            '最大値フィルタ': 2,
            '最頻値フィルタ': 3
        }
    });
    const isRootSumSquire = rpgen3.addInputBool(kernel.foot, {
        label: 'カーネルの転置行列の畳み込み積分と二乗和平方根をとる(向きがあるフィルタに有効)',
        save: true
    });
    isNonLinear.elm.on('change', () => {
        if(isNonLinear()) {
            kernel.html.add(kernel.select).add(kernel.foot).hide();
            nonLinear.html.show();
        }
        else {
            kernel.html.add(kernel.select).add(kernel.foot).show();
            nonLinear.html.hide();
        }
    }).trigger('change');
    const selectOutline = rpgen3.addSelect(body, {
        label: '外周画像の処理',
        save: true,
        list: {
            '外周部分を中心にして対称の位置をコピー': 0,
            '外周部分の画素値をコピー': 1,
            '全部黒': 2
        }
    });
    const selectBinarized = rpgen3.addSelect(body, {
        label: '二値化手法',
        save: true,
        list: {
            '閾値0x80でAND演算(最速)': 0,
            '適応二値化処理': 1,
            '大津の二値化処理': 2
        }
    });
    const isDoingMain = rpgen3.addInputBool(body, {
        label: '空間フィルタリングをする',
        save: true,
        value: true
    });
    const isDoingReverse = rpgen3.addInputBool(body, {
        label: '反転する',
        save: true,
        value: true
    });
    const isDoingBinarize = rpgen3.addInputBool(body, {
        label: '二値化する',
        save: true,
        value: true
    });
    addBtn(body, '処理開始', () => start());
    const msg = new class {
        constructor(){
            this.html = $('<div>').appendTo(foot);
        }
        async print(str){
            this.html.text(str);
            await sleep(0);
        }
    };
    const output = new class {
        constructor(){
            this.tab = $('<div>').appendTo(foot);
            this.html = $('<div>').appendTo(foot);
            this.list = new Map;
        }
        init(){
            this.tab.add(this.html).empty();
            this.list.clear();
        }
        add({label, data, width, height, k}){
            const {_k, __k, _width, _height} = calcAny({k, width, height}),
                  [cv, ctx] = makeCanvas(width, height);
            ctx.putImageData(new ImageData(this.toOpacity(data), _width, _height), -_k, -_k);
            const html = $('<div>').appendTo(this.html).hide().append(cv);
            this.makeBtnDL(label, cv.get(0).toDataURL()).appendTo(html);
            const tab = addBtn(this.tab, label, () => this.showTab(label)).addClass('tab');
            this.list.set(label, [tab, html]);
        }
        showTab(label){
            this.tab.children().removeClass('tab-selected');
            this.html.children().hide();
            const [tab, html] = this.list.get(label);
            tab.addClass('tab-selected');
            html.show();
        }
        makeBtnDL(label, href){
            return $('<div>').append(
                $('<button>').text('保存').on('click', () => {
                    $('<a>').attr({href, download: `${label}.png`}).get(0).click();
                })
            );
        }
        toOpacity(data){
            for(let i = 3; i < data.length; i += 4) data[i] = 255;
            return data;
        }
    };
    const makeCanvas = (width, height) => {
        const cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        return [cv, ctx];
    };
    const start = async () => {
        output.init();
        const {k, list} = kernel,
              {img} = image,
              {width, height} = img,
              [cv, ctx] = makeCanvas(width, height);
        ctx.drawImage(img, 0, 0);
        let data = await makeDataOutlined({ // 外周を埋めた配列
            data: ctx.getImageData(0, 0, width, height).data,
            width, height, k
        });
        const _output = label => {
            output.add({data, width, height, k, label});
            output.showTab(label);
        };
        _output('入力');
        if(isDoingMain()) {
            data = await spatialFilter({data, width, height, k, list: list.slice()});
            _output('出力');
        }
        if(isDoingReverse()) {
            data = await makeDataReversed(data);
            _output('反転');
        }
        if(isDoingBinarize()){
            data = await makeDataBinarized({data, k, width, height});
            _output('二値化');
        }
        await msg.print('全ての処理が完了しました。');
    };
    const calcAny = ({k, width, height}) => { // 地味に必要な計算
        const _k = k >> 1, // 端の幅
              __k = _k << 1, // 両端の幅
              _width = width + __k, // 外周を埋めた幅
              _height = height + __k; // 外周を埋めた高さ
        return {_k, __k, _width, _height};
    };
    const makeDataOutlined = async ({data, width, height, k}) => {
        await msg.print('外周を補完します。');
        const {_k, __k, _width, _height} = calcAny({k, width, height}),
              _data = new Uint8ClampedArray(_width * _height << 2);
        for(const i of Array(width * height).keys()) {
            const [x, y] = toXY(width, i),
                  a = i << 2,
                  b = (x + _k) + (y + _k) * _width << 2;
            Object.assign(_data.subarray(b, b + 3), data.subarray(a, a + 3));
        }
        const outline = selectOutline();
        if(outline === 2) return _data;
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
    const luminance = (r, g, b) => r * 0.298912 + g * 0.586611 + b * 0.114478;
    const makeDataLuminance = async data => {
        await msg.print('輝度を取得します。');
        const _data = new Uint8ClampedArray(data.length >> 2);
        for(const i of _data.keys()) {
            const _i = i << 2;
            _data[i] = luminance(...data.subarray(_i, _i + 3));
        }
        return _data;
    };
    const spatialFilter = async ({width, height, k, data, list}) => {
        const {_k, __k, _width, _height} = calcAny({k, width, height});
        const _data = data.slice(),
              indexs = list.slice(), // 注目する画素及びその近傍の座標
              sum = [...Array(3).fill(0)]; // 積和の計算結果を格納するためのRGB配列
        const func = await (async () => {
            if(isNonLinear()) {
                const func = (() => {
                    switch(selectNonLinear()) {
                        case 0: return a => rpgen3.median(a);
                        case 1: return a => Math.min(...a);
                        case 2: return a => Math.max(...a);
                        case 3: return a => rpgen3.mode(a);
                    }
                })();
                const lums = await makeDataLuminance(data),
                      arr = list.slice(); // 輝度値を格納する配列
                return ({...arg}) => processNonLinear({...arg, func, lums, arr});
            }
            else {
                if(isRootSumSquire()) {
                    const _list = toTransposed(list),
                          _sum = sum.slice();
                    return ({...arg}) => processLinear2({...arg, _list, _sum});
                }
                else return ({...arg}) => processLinear({...arg});
            }
        })();
        const len = width * height;
        let cnt = 0;
        for(const i of Array(len).keys()) { // 元画像の範囲のみ走査する
            if(!(++cnt % 1000)) await msg.print(`空間フィルタリング(${i}/${len})`);
            const [x, y] = toXY(width, i);
            for(const i of list.keys()) { // 座標ゲットだぜ！
                const [_x, _y] = toXY(k, i);
                indexs[i] = toI(_width, x + _x, y + _y) << 2;
            }
            sum.fill(0); // 0で初期化
            func({data, list, indexs, sum});
            const _i = toI(_width, x + _k, y + _k) << 2;
            Object.assign(_data.subarray(_i, _i + 3), sum);
        }
        return _data;
    };
    const processLinear = ({data, list, indexs, sum}) => {
        for(const [i, v] of indexs.entries()) {
            const rgb = data.subarray(v, v + 3),
                  k = list[i];
            for(let i = 0; i < 3; i++) sum[i] += rgb[i] * k;
        }
    };
    const processLinear2 = ({data, list, indexs, sum, _list, _sum}) => {
        _sum.fill(0);
        for(const [i, v] of indexs.entries()) {
            const rgb = data.subarray(v, v + 3),
                  k = list[i],
                  _k = _list[i];
            for(let i = 0; i < 3; i++) {
                const v = rgb[i];
                sum[i] += v * k;
                _sum[i] += v * _k;
            }
        }
        for(let i = 0; i < 3; i++) sum[i] = Math.sqrt(sum[i] ** 2 + _sum[i] ** 2);
    };
    const processNonLinear = ({data, list, indexs, sum, func, lums, arr}) => {
        const m = new Map;
        for(const [i, v] of indexs.entries()) {
            const lum = lums[v >> 2];
            m.set(lum, v);
            arr[i] = lum;
        }
        const i = m.get(func(arr));
        Object.assign(sum, data.subarray(i, i + 3));
    };
    const makeDataReversed = async data => {
        await msg.print('出力を反転します。');
        const _data = data.slice();
        for(const i of Array(data.length >> 2).keys()) {
            const _i = i << 2;
            Object.assign(_data.subarray(_i, _i + 3), data.subarray(_i, _i + 3).map(v => 255 - v));
        }
        return _data;
    };
    const makeDataBinarized = async ({data, k, width, height}) => {
        await msg.print('反転を二値化します。');
        const {_k, __k, _width, _height} = calcAny({k, width, height}),
              lums = await makeDataLuminance(data);
        const _lums = await (async () => {
            switch(selectBinarized()) {
                case 0: return binarizeAND(lums);
                case 1: return binarizeAdaptive({lums, width, height, _width, _k, k});
                case 2: return binarizeOtsu(lums);
            }
        })();
        const _data = data.slice();
        for(const [i, v] of _lums.entries()) {
            const _i = i << 2;
            _data[_i] = _data[_i + 1] = _data[_i + 2] = v ? 255 : 0;
        }
        return _data;
    };
    const binarizeAND = lums => {
        for(const i of Array(lums.length).keys()) lums[i] &= 0x80;
        return lums;
    };
    const binarizeAdaptive = async ({lums, width, height, _width, _k, k}) => {
        const _lums = lums.slice(),
              w = k,
              _w = k >> 1,
              arr = [...Array(w ** 2).keys()],
              len = width * height;
        let cnt = 0;
        for(const i of Array(len).keys()) {
            if(!(++cnt % 1000)) await msg.print(`適応二値化処理(${i}/${len})`);
            const [x, y] = toXY(width, i);
            for(const i of arr.keys()) {
                const [_x, _y] = toXY(w, i);
                arr[i] = lums[toI(_width, x + _x, y + _y)];
            }
            const _i = toI(_width, x + _w, y + _w);
            _lums[_i] = lums[_i] >= rpgen3.mean(arr) / 1.1 | 0;
        }
        return _lums;
    };
    // https://algorithm.joho.info/programming/python/opencv-otsu-thresholding-py/
    const binarizeOtsu = lums => {
        const hist = [...Array(256).fill(0)],
              _hist = hist.slice();
        for(const lum of lums) hist[lum]++;
        let sum = 0;
        for(const [i, v] of hist.entries()) {
            sum += (_hist[i] = i * v);
        }
        let n1 = 0,
            n2 = lums.length,
            _1 = 0,
            _2 = sum;
        const s_max = [0, -10];
        for(const [th, v] of hist.entries()) {
            // クラス1とクラス2の画素数を計算
            n1 += v;
            n2 -= v;
            // クラス1とクラス2の画素値の平均を計算
            const _v = _hist[th];
            _1 += _v;
            _2 -= _v;
            const mu1 = n1 ? _1 / n1 : 0,
                  mu2 = n2 ? _2 / n2 : 0;
            // クラス間分散の分子を計算
            const s = n1 * n2 * (mu1 - mu2) ** 2;
            // クラス間分散の分子が最大のとき、クラス間分散の分子と閾値を記録
            if(s > s_max[1]) {
                s_max[0] = th;
                s_max[1] = s;
            }
        }
        // クラス間分散が最大のときの閾値を取得
        const t = s_max[0];
        // 算出した閾値で二値化処理
        for(const [i, v] of lums.entries()) lums[i] = v > t | 0;
        return lums;
    };
})();
