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
        'kernel'
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
            this.configCommon = $('<div>').appendTo(body);
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
    const inputKernelSize = rpgen3.addInputNum(kernel.configCommon, {
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
    const isKernelSum1 = rpgen3.addInputBool(kernel.config, {
        label: 'kernelの合計が1になるように総和で割る',
        save: true,
        value: true
    });
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
            kernel.config.hide();
            nonLinear.html.show();
        }
        else {
            kernel.html.show();
            kernel.config.show();
            nonLinear.html.hide();
        }
    }).trigger('change');
    const selectOutline = rpgen3.addSelect(body, {
        label: '外周画像の処理',
        save: true,
        list: {
            '外周部分の画素値をコピー': 0,
            '外周部分を中心にして対称の位置をコピー': 1,
            '全部黒': 2,
            'カーネルの形を変える': 3
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
            this.config = $('<div>').appendTo(foot);
            this.html = $('<div>').appendTo(foot);
        }
        show({data, width, height, k}){
            const {_k, __k, _width, _height} = calcAny({k, width, height});
            const [cv, ctx] = makeCanvas(width, height);
            ctx.putImageData(new ImageData(data, _width, _height), -_k, -_k);
            this.html.add(this.config).empty();
            cv.appendTo(this.html);
            this.addBtnDL(cv);
        }
        addBtnDL(cv){
            addBtn(this.config, '保存', () => {
                $('<a>').attr({
                    href: cv.get(0).toDataURL(),
                    download: 'spatialFilter.png'
                }).get(0).click();
            });
        }
    };
    const makeCanvas = (width, height) => {
        const cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        return [cv, ctx];
    };
    const start = async () => {
        const outline = selectOutline(),
              {k, list} = kernel,
              {img} = image,
              {width, height} = img,
              [cv, ctx] = makeCanvas(width, height);
        ctx.drawImage(img, 0, 0);
        const dataOutlined = await makeDataOutlined({ // 外周を埋めた配列
            data: ctx.getImageData(0, 0, width, height).data, width, height, k, outline
        }),
              dataLuminance = await makeDataLuminance(dataOutlined); // 輝度値を計算した配列
        const result = await spatialFilter({
            dataOutlined, dataLuminance,
            width, height, k, outline,
            list: list.slice()
        });
        output.show({data: result, width, height, k});
    };
    const calcAny = ({k, width, height}) => { // 地味に必要な計算
        const _k = k >> 1, // 端の幅
              __k = _k << 1, // 両端の幅
              _width = width + __k, // 外周を埋めた幅
              _height = height + __k; // 外周を埋めた高さ
        return {_k, __k, _width, _height};
    };
    const makeDataOutlined = async ({data, width, height, k, outline}) => {
        const {_k, __k, _width, _height} = calcAny({k, width, height}),
              _data = new Uint8ClampedArray(_width * _height << 2);
        for(const i of Array(width * height).keys()) {
            const x = i % width,
                  y = i / width | 0,
                  a = i << 2,
                  b = (x + _k) + (y + _k) * _width << 2;
            Object.assign(_data.subarray(b, b + 4), data.subarray(a, a + 4));
        }
        if(isIgnoredAlpha()) {
            for(let i = 0; i < _data.length; i += 4) _data[i + 3] = 255;
        }
        if(outline === 2 || outline === 3) return _data;
        // 左上
        /*{
            for(const y of Array(_k).keys()) {
                for(const x of Array(_k).keys()) {
                    y - _k
                    x - _k
                }
            }
        }*/
    };
    const luminance = (r, g, b) => r * 0.298912 + g * 0.586611 + b * 0.114478 | 0;
    const makeDataLuminance = async data => {
        const _data = new Uint8ClampedArray(data.length >> 2);
        for(const i of _data.keys()) {
            const _i = i << 2;
            _data[i] = luminance(...data.subarray(_i, _i + 4));
        }
        return _data;
    };
    const spatialFilter = async ({
        dataOutlined, dataLuminance,
        width, height, k, outline,
        list
    }) => {
        const {_k, __k, _width, _height} = calcAny({k, width, height});
        const _data = dataOutlined.slice(),
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
            else {
                const divide = isKernelSum1() ? list.reduce((p, x) => p + x) : 1;
                return ({...arg}) => processLinear({...arg, divide});
            }
        })();
        let cnt = 0;
        for(const i of Array(len).keys()) { // 元画像の範囲のみ走査する
            if(!(++cnt % 1000)) await msg.print(`${i}/${len}`);
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
            func({data: dataOutlined, list, indexs, sum});
            const _i = toI(x, y) << 2;
            Object.assign(_data.subarray(_i, _i + 4), sum);
        }
        return _data;
    };
    const processLinear = ({data, list, indexs, sum, divide}) => {
        for(const [i, v] of indexs.entries()) {
            const rgba = data.subarray(v, v + 4),
                  k = list[i];
            for(let i = 0; i < 4; i++) sum[i] += rgba[i] * k;
        }
        for(const i of sum.keys()) sum[i] /= divide;
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
})();
