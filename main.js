(async () => {
    const {importAll, getScript, importAllSettled} = await import(`https://rpgen3.github.io/mylib/export/import.mjs`);
    await getScript('https://code.jquery.com/jquery-3.3.1.min.js');
    const {$} = window;
    const html = $('body').empty().css({
        'text-align': 'center',
        padding: '1em',
        'user-select': 'none'
    });
    const head = $('<header>').appendTo(html),
          main = $('<main>').appendTo(html),
          foot = $('<footer>').appendTo(html);
    $('<h1>').appendTo(head).text('空間フィルタリングのテスト');
    const rpgen3 = await importAll([
        'input',
        'css',
        'url',
        'hankaku',
        'sample',
        'util'
    ].map(v => `https://rpgen3.github.io/mylib/export/${v}.mjs`));
    const rpgen4 = await importAll([
        'binarizeAND',
        'binarizeOtsu',
        'kernel',
        'main',
        'makeLuminance',
        'makeOutline',
        'toOpacity',
        'toReverse'
    ].map(v => `https://rpgen3.github.io/spatialFilter/mjs/${v}.mjs`));
    Promise.all([
        'container',
        'table',
        'kernel',
        'tab',
        'img'
    ].map(v => `css/${v}.css`).map(rpgen3.addCSS));
    $('<h2>').appendTo(main).text('処理する画像の設定');
    const image = new class {
        constructor(){
            const html = $('<div>').appendTo(main).addClass('container');
            $('<h3>').appendTo(html).text('選べる３種類の入力方法');
            this.input = $('<dl>').appendTo(html);
            this.output = $('<div>').appendTo(html);
            this.img = null;
        }
        async load(url){
            $(this.img = await rpgen3.loadSrc('img', url)).appendTo(this.output.empty());
        }
    };
    { // 画像入力
        const {input} = image;
        const selectImg = rpgen3.addSelect(input, {
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
        const inputURL = rpgen3.addInputStr(input, {
            label: '外部URL',
            save: true
        });
        inputURL.elm.prop({
            placeholder: 'CORS非対応のURLは使えません'
        });
        inputURL.elm.on('change', () => {
            const urls = rpgen3.findURL(inputURL());
            if(urls.length) image.load(urls[0]);
        });
        (rpgen3.findURL(inputURL()).length ? inputURL : selectImg).elm.trigger('change');
        $('<dt>').appendTo(input).text('ファイル入力');
        $('<input>').appendTo($('<dd>').appendTo(input)).prop({
            type: 'file'
        }).on('change', ({target}) => {
            const {files} = target;
            if(files.length) image.load(URL.createObjectURL(files[0]));
        });
    }
    const selectOutline = rpgen3.addSelect(main, {
        label: '外周画像の処理',
        save: true,
        list: {
            '外周部分を中心にして対称の位置をコピー': 0,
            '外周部分の画素値をコピー': 1,
            '全部黒': 2
        }
    });
    const inputKernelSize = rpgen3.addInputNum(main, {
        label: '局所領域[n×n]',
        save: true,
        value: 3,
        min: 3,
        max: 23,
        step: 2
    });
    const hideTime = 500;
    const addHideArea = (label, parentNode = main) => {
        const html = $('<div>').addClass('container').appendTo(parentNode);
        const input = rpgen3.addInputBool(html, {
            label,
            save: true,
            value: true
        });
        const area = $('<dl>').appendTo(html);
        input.elm.on('change', () => input() ? area.show(hideTime) : area.hide(hideTime)).trigger('change');
        return Object.assign(input, {
            get html(){
                return area;
            }
        });
    };
    const spatialFilter = new class {
        constructor(){
            this.isOpened = addHideArea('空間フィルタリングを行う');
            const html = this.isOpened.html;
            this.select = rpgen3.addSelect(html, {
                label: 'フィルタの線形性',
                save: true,
                list: {
                    '線形': true,
                    '非線形': false
                }
            });
            this.linear = $('<dl>').appendTo(html);
            this.nonLinear = $('<dl>').appendTo(html);
            this.select.elm.on('change', () => {
                if(this.select()) {
                    this.nonLinear.hide(hideTime);
                    this.linear.show(hideTime);
                }
                else {
                    this.linear.hide(hideTime);
                    this.nonLinear.show(hideTime);
                }
            }).trigger('change');
        }
    };
    const linear = new class {
        constructor(){
            const html = spatialFilter.linear;
            this.select = rpgen3.addSelect(html, {
                label: '線形フィルタ',
                save: true,
                list: rpgen4.kernel
            });
            this.kernel = $('<table>').appendTo(html);
            $('<dt>').appendTo(html).text('オプション');
            this.isTr = rpgen3.addInputBool(html, {
                label: 'カーネルの転置行列の畳み込み積分と二乗和平方根をとる(向きがあるフィルタに有効)',
                save: true
            });
        }
    };
    const nonLinear = new class {
        constructor(){
            const html = spatialFilter.nonLinear;
            this.list = {
                '中央値': 0,
                '最小値': 1,
                '最大値': 2,
                '最頻値': 3,
                '刈り込み平均値': 4,
                'Winsorized平均値': 5,
                'ミッドレンジ': 6
            };
            this.select = rpgen3.addSelect(html, {
                label: '非線形フィルタ',
                save: true,
                list: this.list
            });
        }
    };
    const kernel = new class {
        constructor(){
            this.html = linear.kernel;
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
            const {toI} = rpgen4;
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
    inputKernelSize.elm.on('change', () => {
        kernel.resize(inputKernelSize());
    }).trigger('change');
    linear.select.elm.on('change', () => {
        const k = linear.select();
        inputKernelSize(Math.sqrt(k.length));
        inputKernelSize.elm.trigger('change');
        for(const [i, v] of k.entries()) kernel.input(i, v);
    }).trigger('change');
    const isReverse = rpgen3.addInputBool(main, {
        label: 'ネガポジ反転を行う',
        save: true,
        value: true
    });
    const binarize = new class {
        constructor(){
            this.isOpened = addHideArea('二値化を行う');
            const html = this.isOpened.html;
            this.select = rpgen3.addSelect(html, {
                label: '二値化手法',
                save: true,
                list: {
                    '閾値0x80でAND演算(最速)': 0,
                    '適応二値化処理': 1,
                    '大津の二値化処理': 2
                }
            });
            this.adaptive = $('<dl>').appendTo(html);
            this.select.elm.on('change', () => {
                if(this.select() === 1) this.adaptive.show(hideTime);
                else this.adaptive.hide(hideTime);
            }).trigger('change');
        }
    };
    const adaptive = new class {
        constructor(){
            const html = binarize.adaptive;
            this.select = rpgen3.addSelect(html, {
                label: '適応二値化処理の代表値',
                save: true,
                list: {
                    '大津の二値化': -2,
                    '平均値': -1,
                    ...nonLinear.list
                }
            });
            this.sub = rpgen3.addInputNum(html, {
                label: '計算された閾値から引く定数',
                save: true,
                value: 11,
                min: 0,
                max: 255
            });
        }
    };
    let started = false;
    rpgen3.addBtn(main, '処理の開始', async () => {
        if(started) return;
        started = true;
        await start();
        started = false;
    });
    const msg = new class {
        constructor(){
            this.html = $('<div>').appendTo(main);
        }
        async print(str){
            this.html.text(str);
            await rpgen3.sleep(0);
        }
    };
    const output = new class {
        constructor(){
            this.tab = $('<div>').appendTo(main);
            this.html = $('<div>').appendTo(main);
            this.list = new Map;
        }
        init(){
            this.tab.add(this.html).empty();
            this.list.clear();
        }
        add({label, data, width, height, k}){
            const {_k, __k, _width, _height} = rpgen4.calcAny({k, width, height}),
                  {cv, ctx} = rpgen3.makeCanvas(width, height);
            ctx.putImageData(new ImageData(rpgen4.toOpacity(data), _width, _height), -_k, -_k);
            const html = $('<div>').appendTo(this.html).hide().append(cv);
            this.makeBtnDL(label, cv.toDataURL()).appendTo(html);
            const tab = rpgen3.addBtn(this.tab, label, () => this.showTab(label)).addClass('tab');
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
    };
    const start = async () => {
        output.init();
        const {k} = kernel,
              {img} = image,
              width = img.naturalWidth,
              height = img.naturalHeight,
              {ctx} = rpgen3.makeCanvas(width, height);
        ctx.drawImage(img, 0, 0);
        let data = rpgen4.makeOutline({ // 外周を埋めた配列
            data: ctx.getImageData(0, 0, width, height).data,
            width, height, k,
            outline: selectOutline()
        });
        const _output = label => {
            output.add({data, width, height, k, label});
            output.showTab(label);
        };
        _output('入力');
        if(spatialFilter.isOpened()) {
            data = await mainSpatialFilter({k, width, height, data, kernel: kernel.list.slice()});
            _output('出力');
        }
        if(isReverse()) {
            data = rpgen4.toReverse(data);
            _output('反転');
        }
        if(binarize.isOpened()){
            data = await mainBinarize({k, width, height, data});
            _output('二値化');
        }
        await msg.print('全ての処理が完了しました。');
    };
    const mainSpatialFilter = async ({k, width, height, data, kernel}) => {
        const {_k, __k, _width, _height} = rpgen4.calcAny({k, width, height});
        const sum = [...Array(3).fill(0)]; // 積和の計算結果を格納するためのRGB配列
        const func = await (async () => {
            if(spatialFilter.select()) {
                if(linear.isTr()) {
                    const _kernel = rpgen4.toTransposed(kernel),
                          _sum = sum.slice();
                    return ({...arg}) => rpgen4.linear2({...arg, _kernel, _sum});
                }
                else return ({...arg}) => rpgen4.linear({...arg});
            }
            else {
                const func = (() => {
                    switch(nonLinear.select()) {
                        case 0: return a => rpgen3.median(a);
                        case 1: return a => Math.min(...a);
                        case 2: return a => Math.max(...a);
                        case 3: return a => rpgen3.mode(a);
                        case 4: return a => rpgen3.meanTrim(a);
                        case 5: return a => rpgen3.meanTrim(a, 0.1, true);
                        case 6: return a => rpgen3.midrange(a);
                    }
                })();
                const luminance = rpgen4.makeLuminance(data);
                return ({...arg}) => rpgen4.nonLinear({...arg, luminance, func});
            }
        })();
        const {toI, toXY} = rpgen4;
        const _data = data.slice(),
              index = kernel.slice(), // 注目する画素及びその近傍の座標
              len = width * height;
        let cnt = 0;
        for(const i of Array(len).keys()) { // 元画像の範囲のみ走査する
            if(!(++cnt % 1000)) await msg.print(`空間フィルタリング(${i}/${len})`);
            const [x, y] = toXY(width, i);
            for(const i of index.keys()) { // 座標ゲットだぜ！
                const [_x, _y] = toXY(k, i);
                index[i] = toI(_width, x + _x, y + _y) << 2;
            }
            const _i = toI(_width, x + _k, y + _k) << 2;
            Object.assign(_data.subarray(_i, _i + 3), func({data, index, kernel, sum}));
        }
        return _data;
    };
    const mainBinarize = async ({k, width, height, data}) => {
        await msg.print('反転を二値化します。');
        const {_k, __k, _width, _height} = rpgen4.calcAny({k, width, height}),
              lums = rpgen4.makeLuminance(data);
        const _lums = await (async () => {
            switch(binarize.select()) {
                case 0: return rpgen4.binarizeAND(lums);
                case 1: return mainAdaptive({lums, width, height, _width, k, _k});
                case 2: return mainOtsu(lums);
            }
        })();
        const _data = data.slice();
        for(const [i, v] of _lums.entries()) {
            const _i = i << 2;
            _data[_i] = _data[_i + 1] = _data[_i + 2] = v ? 255 : 0;
        }
        return _data;
    };
    const mainAdaptive = async ({lums, width, height, _width, k, _k}) => {
        const _lums = lums.slice(),
              arr = [...Array(k ** 2).keys()],
              len = width * height;
        const func = (() => {
            switch(adaptive.select()){
                case -2: return a => rpgen4.binarizeOtsu(a);
                case -1: return a => rpgen3.mean(a);
                case 0: return a => rpgen3.median(a);
                case 1: return a => Math.min(...a);
                case 2: return a => Math.max(...a);
                case 3: return a => rpgen3.mode(a);
                case 4: return a => rpgen3.meanTrim(a);
                case 5: return a => rpgen3.meanTrim(a, 0.1, true);
                case 6: return a => rpgen3.midrange(a);
            }
        })();
        const {toI, toXY} = rpgen4;
        const {sub} = adaptive;
        let cnt = 0;
        for(const i of Array(len).keys()) {
            if(!(++cnt % 1000)) await msg.print(`適応二値化処理(${i}/${len})`);
            const [x, y] = toXY(width, i);
            for(const i of arr.keys()) {
                const [_x, _y] = toXY(k, i);
                arr[i] = lums[toI(_width, x + _x, y + _y)];
            }
            const _i = toI(_width, x + _k, y + _k);
            _lums[_i] = lums[_i] >= func(arr) - sub | 0;
        }
        return _lums;
    };
    const mainOtsu = lums => {
        const t = rpgen4.binarizeOtsu(lums);
        for(const [i, v] of lums.entries()) lums[i] = v > t | 0; // 算出した閾値で二値化処理
        return lums;
    };
})();
