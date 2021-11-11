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
        'util',
        'random',
        'css'
    ].map(v => `https://rpgen3.github.io/mylib/export/${v}.mjs`));
    const {LayeredCanvas, lerp} = await importAll([
        'LayeredCanvas',
        'lerp'
    ].map(v => `https://rpgen3.github.io/maze/mjs/sys/${v}.mjs`));
    const rpgen4 = await importAll([
        'bfs'
    ].map(v => `https://rpgen3.github.io/dot/mjs/${v}.mjs`));
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
    const img = new class {
        constructor(){
            this.html = $('<div>').appendTo(body);
            this._load = makeLoadFunc(Image);
            this.img = null;
        }
        async load(url){
            this.html.empty().append(this.img = await this._load(url));
        }
    };
    { // 画像入力
        const selectImg = rpgen3.addSelect(head, {
            label: 'サンプル画像',
            save: true,
            list: {
                'レナ': 'Lenna.png',
                'アニメ風レナ': 'Lena_all.png',
                'マンドリル': 'Mandrill.png'
            }
        });
        selectImg.elm.on('change', () => {
            img.load(`img/${selectImg()}`);
        }).trigger('change');
        const inputURL = rpgen3.addInputStr(head, {
            label: '外部URL'
        });
        inputURL.elm.on('change', () => {
            img.load(inputURL());
        });
        $('<input>').appendTo(head).prop({
            type: 'file'
        }).on('change', ({target}) => {
            img.load(URL.createObjectURL(target.files[0]));
        });
    }
    const kernel = new class {
        constructor(){
            this.html = $('<table>').appendTo(body);
            this.list = [];
        }
        toI(x, y){
            return x + y * this.list.length;
        }
        resize(k){
            const _k = Math.sqrt(this.list),
                  sub = k - _k,
                  newlist = [];
            this.html.empty();
            for(const y of Array(k).keys()) {
                const tr = $('<tr>').appendTo(this.html);
                for(const x of Array(k).keys()) {
                    const n = this.toI(...[x, y].map(v => v - sub)) || 0;
                    newlist.push(n);
                    $('<td>').prop({
                        contenteditable: true
                    }).appendTo(tr).text(n);
                }
            }
            this.list = newlist;
        }
    };
    const inputKernelSize = rpgen3.addInputNum(body, {
        label: 'カーネルサイズ[n x n]',
        save: true,
        value: 3,
        min: 3,
        max: 27,
        step: 2
    });
    inputKernelSize.elm.on('change', () => {
        kernel.resize(inputKernelSize());
    }).trigger('change');
    addBtn(body, '処理開始', () => spatialFilter());
    const msg = new class {
        constructor(){
            this.html = $('<div>').appendTo(foot);
        }
        async print(str){
            this.html.text(str);
            await sleep(10);
        }
    };
    const spatialFilter = async () => {
        const {width, height} = img.img,
              cv = $('<canvas>').prop({width, height}),
              ctx = cv.get(0).getContext('2d');
        ctx.drawImage(img.img, 0, 0);
        const {data} = ctx.getImageData(0, 0, width, height);
    };
})();
