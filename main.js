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
        'url'
    ].map(v => `https://rpgen3.github.io/mylib/export/${v}.mjs`));
    Promise.all([
        'table'
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
                        const n = Number(td.text()) || 0;
                        this.list[this.toI(x, y)] = n;
                        td.text(n);
                    });
                }
            }
            this.k = k;
            this.list = list;
        }
    };
    const inputKernelSize = rpgen3.addInputNum(kernel.config, {
        label: 'カーネルサイズ[n x n]',
        save: true,
        value: 3,
        min: 3,
        max: 9,
        step: 2
    });
    inputKernelSize.elm.on('change', () => {
        kernel.resize(inputKernelSize());
    }).trigger('change');
    const isKernelSum1 = rpgen3.addInputBool(kernel.config, {
        label: 'kernelの合計が1になるように総和で割る',
        save: true
    });
    const selectOutline = rpgen3.addSelect(body, {
        label: '外周画像の処理',
        list: {
            '外周部分の画素値をコピー': 0,
            '外周部分を中心にして対称の位置をコピー': 1,
            '全部黒': 2,
            'カーネルの形を変える': 3
        }
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
    const hOutput = $('<div>').appendTo(foot);
    const start = async () => {
        const isSum1 = isKernelSum1(),
              outline = selectOutline(),
              {k, list} = kernel,
              _list = list.slice(),
              {img} = image,
              {width, height} = img,
              [cv, ctx] = makeCanvas(width, height);
        ctx.drawImage(img, 0, 0);
        const {data} = ctx.getImageData(0, 0, width, height),
              _k = k >> 1,
              __k = _k << 1,
              _width = width + __k,
              _height = height + __k;
        const result = await spatialFilter({
            width, height, k, _k, __k, _width, _height, outline, isSum1,
            data: await makeBigImg({width, height, k, _k, __k, _width, _height, outline, data}),
            list: _list
        });
        output({data, width, height, _width, _height, _k});
    };
    const makeBigImg = async ({width, height, k, _k, __k, _width, _height, outline, data}) => {
        const _data = new Uint8ClampedArray(_width * _height << 2);
        for(const i of Array(width * height).keys()) {
            const x = i % width,
                  y = i / width | 0,
                  _i = x + y * _width << 2,
                  __i = i << 2;
            Object.assign(_data.subarray(_i, _i + 4), data.subarray(__i, __i + 4));
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
    const spatialFilter = async ({width, height, k, _k, __k, _width, _height, outline, data, list, isSum1}) => {
        const divide = isSum1 ? list.reduce((p, x) => p + x) : 1,
              _data = data.slice(),
              toI = (x, y) => x + y * _width,
              len = width * height;
        for(const i of Array(len).keys()) {
            await msg.print(`${i}/${len}`);
            const x = (i % width) + _k,
                  y = (i / width | 0) + _k,
                  sum = [...new Array(4).fill(0)];
            for(const [i, v] of list.entries()) {
                const _x = i % k,
                      _y = i / k | 0,
                      _i = toI(
                          x + _x - _k,
                          y + _y - _k
                      ) << 1,
                      rgba = data.subarray(_i, _i + 4);
                for(let i = 0; i < 4; i++) sum[i] += rgba[i] * v;
            }
            const _i = toI(x, y) << 1;
            Object.assign(_data.subarray(_i, _i + 4), sum.map(v => v / divide));
        }
        return _data;
    };
    const output = ({data, width, height, _width, _height, _k}) => {
        const [cv, ctx] = makeCanvas(width, height);
        ctx.putImageData(new ImageData(data, _width, _height), -_k, -_k);
        cv.appendTo(hOutput.empty());
    };
    const makeCanvas = (width, height) => {
        const cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        return [cv, ctx];
    };
})();
