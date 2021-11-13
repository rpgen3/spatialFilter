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
        'tab'
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
            this.html.empty().append(this.img = await this._load(url));
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
        }).trigger('change');
        const inputURL = rpgen3.addInputStr(image.config, {
            label: '外部URL'
        });
        inputURL.elm.on('change', () => {
            const urls = rpgen3.findURL(inputURL());
            if(urls.length) image.load(urls[0]);
        });
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
    const kernel = new class {
        constructor(){
            this.config = $('<div>').appendTo(body);
            this.html = $('<table>').appendTo(body);
            this.k = 0;
            this.list = [];
        }
        toI(x, y){
            return x + y * this.k;
        }
        resize(k){
            const _k = k - this.k >> 1,
                  list = [];
            this.html.empty();
            for(const y of Array(k).keys()) {
                const tr = $('<tr>').appendTo(this.html);
                for(const x of Array(k).keys()) {
                    const [_x, _y] = [x, y].map(v => v - _k),
                          n = _x < 0 || _x >= this.k || _y < 0 || _y >= this.k ? 0 : this.list[this.toI(_x, _y)] || 0;
                    list.push(n);
                    const td = $('<td>').appendTo(tr).prop({
                        contenteditable: true
                    }).text(n).on('focusout', () => {
                        const n = Number(rpgen3.toHan(td.text())) || 0;
                        this.list[this.toI(x, y)] = n;
                        td.text(n);
                    }).addClass(`kernel${Math.max(...[x, y].map(v => v - (k >> 1)).map(Math.abs))}`);
                }
            }
            this.k = k;
            this.list = list;
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
    inputKernelSize.elm.on('input', () => {
        kernel.resize(inputKernelSize());
    }).trigger('input');
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
    isNonLinear.elm.on('change', () => {
        if(isNonLinear()) {
            kernel.html.hide();
            nonLinear.html.show();
        }
        else {
            kernel.html.show();
            nonLinear.html.hide();
        }
    }).trigger('change');
    const selectOutline = rpgen3.addSelect(body, {
        label: '外周画像の処理',
        save: true,
        list: {
            '外周部分の画素値をコピー': 1,
            '外周部分を中心にして対称の位置をコピー': 0,
            '全部黒': 2
        }
    });
    const isIgnoredAlpha = rpgen3.addInputBool(body, {
        label: '不透明度をすべて無視',
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
            this.isOpacity = false;
        }
        init(){
            this.tab.add(this.html).empty();
            this.list.clear();
            this.isOpacity = isIgnoredAlpha();
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
            if(!this.isOpacity) return data;
            const _data = data.slice();
            for(let i = 3; i < data.length; i += 4) _data[i] = 255;
            return _data;
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
        await msg.print('外周を補完します。');
        const dataOutlined = await makeDataOutlined({ // 外周を埋めた配列
            data: ctx.getImageData(0, 0, width, height).data,
            width, height, k
        });
        output.add({
            label: '入力',
            data: dataOutlined,
            width, height, k
        });
        await msg.print('輝度を取得します。');
        const calcLuminance = isIgnoredAlpha() ? luminance : luminanceAlpha;
        const dataLuminance = await makeDataLuminance({ // 輝度を計算した配列
            data: dataOutlined,
            calcLuminance
        });
        const result = await spatialFilter({
            dataLuminance, width, height, k,
            data: dataOutlined,
            list: list.slice()
        });
        await msg.print('空間フィルタリング完了');
        output.add({
            label: '出力',
            data: result,
            width, height, k
        });
        output.showTab('出力');
        await msg.print('出力を反転します。');
        const dataReversed = await makeDataReversed(result);
        output.add({
            label: '反転',
            data: dataReversed,
            width, height, k
        });
        await msg.print('反転を2値化します。');
        const dataBinarized = await makeDattaBinarized({
            data: dataReversed,
            calcLuminance
        });
        output.add({
            label: '2値化',
            data: dataBinarized,
            width, height, k
        });
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
        const {_k, __k, _width, _height} = calcAny({k, width, height}),
              _data = new Uint8ClampedArray(_width * _height << 2);
        for(const i of Array(width * height).keys()) {
            const x = i % width,
                  y = i / width | 0,
                  a = i << 2,
                  b = (x + _k) + (y + _k) * _width << 2;
            Object.assign(_data.subarray(b, b + 4), data.subarray(a, a + 4));
        }
        const outline = selectOutline();
        if(outline === 2) return _data;
        const toI = (x, y) => x + y * _width;
        const toXY = i => {
            const x = i % _k,
                  y = i / _k | 0;
            return [x, y];
        };
        const put = (a, b) => {
            const _a = a << 2,
                  _b = b << 2;
            Object.assign(_data.subarray(_a, _a + 4), _data.subarray(_b, _b + 4));
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
                    const [x, y] = toXY(i);
                    const _i = outline ? toI(ax + bx, ay + by) : (() => {
                        const [cx, cy] = [bx, by].map(v => v - _k + 1), // 外周の対称の起点
                              [x, y] = toXY(len - i - 1);
                        return toI(x + ax + bx + cx, y + ay + by + cy);
                    })();
                    put(toI(x + ax, y + ay), _i);
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
                    put(toI(kx, _k - a1), toI(kx, _k + o));
                    put(toI(kx, kh + a1), toI(kx, kh - o));
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
                    put(toI(_k - a1, ky), toI(_k + o, ky));
                    put(toI(kw + a1, ky), toI(kw - o, ky));
                }
            }
        }
        return _data;
    };
    const luminance = (r, g, b) => r * 0.298912 + g * 0.586611 + b * 0.114478 | 0;
    const luminanceAlpha = (r, g, b, a) => {
        const rate = a / 255;
        return luminance(...[r, g, b].map(v => v * rate));
    };
    const makeDataLuminance = async ({data, calcLuminance}) => {
        const _data = new Uint8ClampedArray(data.length >> 2);
        for(const i of _data.keys()) {
            const _i = i << 2;
            _data[i] = calcLuminance(...data.subarray(_i, _i + 4));
        }
        return _data;
    };
    const spatialFilter = async ({dataLuminance, width, height, k, data, list}) => {
        const {_k, __k, _width, _height} = calcAny({k, width, height});
        const _data = data.slice(),
              toI = (x, y) => x + y * _width,
              len = width * height,
              indexs = list.slice(), // 注目する画素及びその近傍の座標
              sum = [...Array(4).fill(0)]; // 積和の計算結果を格納するためのRGBA配列
        const func = (() => {
            if(isNonLinear()) {
                const func = (() => {
                    switch(selectNonLinear()) {
                        case 0: return a => rpgen3.median(a);
                        case 1: return a => Math.min(...a);
                        case 2: return a => Math.max(...a);
                        case 3: return a => rpgen3.mode(a);
                    }
                })();
                const lums = list.slice(); // 輝度値を格納する配列
                return ({...arg}) => processNonLinear({...arg, func, lums, dataLuminance});
            }
            else return ({...arg}) => processLinear({...arg});
        })();
        let cnt = 0;
        for(const i of Array(len).keys()) { // 元画像の範囲のみ走査する
            if(!(++cnt % 1000)) await msg.print(`空間フィルタリング(${i}/${len})`);
            const x = (i % width) + _k,
                  y = (i / width | 0) + _k;
            for(const i of list.keys()) { // 座標ゲットだぜ！
                const _x = i % k,
                      _y = i / k | 0;
                indexs[i] = toI(
                    x + _x - _k,
                    y + _y - _k
                ) << 2;
            }
            sum.fill(0); // 0で初期化
            func({data, list, indexs, sum});
            const _i = toI(x, y) << 2;
            Object.assign(_data.subarray(_i, _i + 4), sum);
        }
        return _data;
    };
    const processLinear = ({data, list, indexs, sum}) => {
        for(const [i, v] of indexs.entries()) {
            const rgba = data.subarray(v, v + 4),
                  k = list[i];
            for(let i = 0; i < 4; i++) sum[i] += rgba[i] * k;
        }
    };
    const processNonLinear = ({data, list, indexs, sum, func, lums, dataLuminance}) => {
        const m = new Map;
        for(const [i, v] of indexs.entries()) {
            const lum = dataLuminance[v >> 2];
            m.set(lum, v);
            lums[i] = lum;
        }
        const i = m.get(func(lums));
        Object.assign(sum, data.subarray(i, i + 4));
    };
    const makeDataReversed = async data => {
        const _data = data.slice();
        for(const i of Array(data.length >> 2).keys()) {
            const _i = i << 2;
            Object.assign(_data.subarray(_i, _i + 3), data.subarray(_i, _i + 3).map(v => 255 - v));
        }
        return _data;
    };
    const makeDattaBinarized = async ({data, calcLuminance}) => {
        const _data = data.slice(),
              b = calcLuminance === luminanceAlpha;
        for(const i of Array(data.length >> 2).keys()) {
            const _i = i << 2,
                  lum = calcLuminance(...data.subarray(_i, _i + 4)),
                  bin = lum & 0x80 ? 255 : 0;
            _data[_i] = _data[_i + 1] = _data[_i + 2] = bin;
            if(b) _data[_i + 3] = bin;
        }
        return _data;
    };
})();
