var fs = require("fs");
var updateNav = require('./updateNav');
var autoNav = require('./autoNav');

//两层深度读取文件夹
var readDir = function (path, callback) {
    var dirObj = {};
    fs.readdir(path, function (err, files) {
        if (err) {
            callback(err);
        } else {
            for (var i = 0; i < files.length; i++) {
                if (fs.statSync(path + files[i]).isDirectory(path + files[i])) {
                    dirObj[files[i]] = fs.readdirSync(path + files[i]);
                }
            }
            callback(null, dirObj);
        }
    });
};

//复制文件
var copyFile = function (from, to) {
    var encoding = from.indexOf('png') >= 0 ? 'binary' : 'utf-8';
    var file = fs.readFileSync(from, encoding);
    fs.writeFileSync(to, file, encoding);
};

//创建amWiki需要的文件夹
var createDir = function (outputPath) {
    if (!fs.existsSync(outputPath + 'amWiki/')) {
        fs.mkdirSync(outputPath + 'amWiki/', 0777);
    }
    if (!fs.existsSync(outputPath + 'amWiki/js/')) {
        fs.mkdirSync(outputPath + 'amWiki/js/', 0777);
    }
    if (!fs.existsSync(outputPath + 'amWiki/css')) {
        fs.mkdirSync(outputPath + 'amWiki/css', 0777);
    }
    if (!fs.existsSync(outputPath + 'amWiki/images')) {
        fs.mkdirSync(outputPath + 'amWiki/images', 0777);
    }
    if (!fs.existsSync(outputPath + 'library/')) {
        fs.mkdirSync(outputPath + 'library/', 0777);
        if (!fs.existsSync(outputPath + 'library/01-关于amWiki')) {
            fs.mkdirSync(outputPath + 'library/01-关于amWiki', 0777);
        }
        if (!fs.existsSync(outputPath + 'library/02-学习markdown')) {
            fs.mkdirSync(outputPath + 'library/02-学习markdown', 0777);
        }
        if (!fs.existsSync(outputPath + 'library/03-文档示范')) {
            fs.mkdirSync(outputPath + 'library/03-文档示范', 0777);
        }
        return false;
    }
    return true;
};

//创建着色色系（颜色变亮变暗不是rgb分别同时增加或减少一个值）
var makeColours = function (color) {
    var colours = {};
    //修复16进制下的1位数
    var lessThan = function (str) {
        if (str <= 9) {
            str = '0' + str;
        } else {
            var num = parseInt('0x' + str);
            if (num >= 10 && num <= 15) {
                str = '0' + str;
            }
        }
        return str;
    };
    //颜色合法检查
    var atBinary16 = /^#([0-9a-fA-F]{3}){1,2}$/.test(color);
    var atRGB = /^(r|R)(g|G)(b|B)(a|A)?\(\d{1,3},\d{1,3},\d{1,3}(,.*?)?\)$/.test(color);
    var atList = /(blue|default)/.test(color);
    if (!atBinary16 && !atRGB && !atList) {
        alert('请使用标准16进制颜色、标准RGB颜色、2种特定颜色名指定颜色！本次创建使用默认颜色');
        return makeColours('default');
    }
    //颜色名称转色值
    var colorList = {
        default: '#4296eb',
        blue: '#4296eb'
    };
    if (atList) {
        color = colorList[color];
    }
    //解析颜色为rgb
    var rgb = [];
    if (color.indexOf('#') == 0) {
        rgb[0] = parseInt('0x' + color.substr(1, 2));
        rgb[1] = parseInt('0x' + color.substr(3, 2));
        rgb[2] = parseInt('0x' + color.substr(5, 2));
    } else {
        var rgbStr = color.split('(')[1].split(')')[0].split(',');
        rgb[0] = parseInt(rgbStr[0]);
        rgb[1] = parseInt(rgbStr[1]);
        rgb[2] = parseInt(rgbStr[2]);
    }
    //生成主色base
    colours.base = '#' + [
            lessThan(rgb[0].toString(16)),
            lessThan(rgb[1].toString(16)),
            lessThan(rgb[2].toString(16))
        ].join('');
    //颜色变化量，越小的值变化越大
    var increment = [
        Math.round((255 - rgb[0]) / 3),
        Math.round((255 - rgb[1]) / 3),
        Math.round((255 - rgb[2]) / 3)
    ];
    //生成亮色light
    colours.light = '#' + [
            (rgb[0] + increment[0]).toString(16),
            (rgb[1] + increment[1]).toString(16),
            (rgb[2] + increment[2]).toString(16)
        ].join('');
    //生成暗色dark
    var larger = 0,
        largeIndex = -1;
    var largerFd = function (i) {
        if (increment[i] > larger) {
            larger = increment[i];
            largeIndex = i;
        }
    };
    largerFd(0);
    largerFd(1);
    largerFd(2);
    if (rgb[largeIndex] - larger < 0) {
        //修复加深颜色值为负的情况，最多减到0，其他三色等比例减小
        var reduce = (rgb[largeIndex] - larger) / larger;
        increment[0] += Math.round(increment[0] * reduce);
        increment[1] += Math.round(increment[1] * reduce);
        increment[2] += Math.round(increment[2] * reduce);
    }
    colours.dark = '#' + [
            lessThan((rgb[0] - increment[0]).toString(16)),
            lessThan((rgb[1] - increment[1]).toString(16)),
            lessThan((rgb[2] - increment[2]).toString(16))
        ].join('');
    return colours;
};


module.exports = {
    //创建amWiki本地文件
    buildAt: function (editorPath, configPath, callback) {
        if (editorPath.indexOf('config.json') < 0) {
            alert('当前不是"config.json"文件！');
            return;
        }
        var filesPath = configPath.replace(/\\/g, '/') + '/packages/amWiki/files/';
        var outputPath = editorPath.split('config.json')[0].replace(/\\/g, '/');

        var config = fs.readFileSync(editorPath, 'utf-8') || '';
        if (config.length == 0) {
            if (!confirm('没有读取到任何配置，继续创建么？')) {
                return;
            } else {
                config = "{}";
            }
        }

        //解析默认配置
        var parseOk = true;
        try {
            config = JSON.parse(config);
        } catch (e) {
            alert("config.json 解析失败，请检查您的配置是否正确！\n\r错误消息：" + e.message);
            parseOk = false;
        }
        if (!parseOk) {
            return;
        }
        config.name = config.name || 'amWiki文档库系统';  //库名称
        config.version = typeof config.ver == 'string' ? config.ver : 'by Tevin';  //库版本号
        config.logo = config.logo || 'amWiki/images/logo.png';  //logo地址
        config.testing = config.testing || false;  //是否开启接口测试
        config.colour = config.colour ? makeColours(config.colour) : makeColours('#4296eb');  //设置自定义颜色

        //创建
        fs.readdir(outputPath, function (err, files) {
            if (files.length > 1) {
                if (!confirm('此处已有一些文件或文件夹，是否仍然在此创建amWiki？')) {
                    return;
                }
            }

            //创建index.html
            var indexPage = fs.readFileSync(filesPath + 'index.tpl', 'utf-8');
            indexPage = indexPage.replace(/\{\{name\}\}/g, config.name)
                .replace('{{version}}', config.version)
                .replace('{{logo}}', config.logo);
            if (config.testing) {
                var testingTpl = fs.readFileSync(filesPath + 'testing.tpl', 'utf-8');
                var testingScript = '<script type="text/javascript" src="amWiki/js/amWiki-testing.js"></script>';
                indexPage = indexPage
                    .replace('{{amWiki-testing.tpl}}', testingTpl)
                    .replace('{{amWiki-testing.js}}', testingScript);
            } else {
                indexPage = indexPage.replace('{{amWiki-testing.tpl}}', '').replace('{{amWiki-testing.js}}', '');
            }
            fs.writeFileSync(outputPath + 'index.html', indexPage, 'utf-8');

            //创建amWiki.css
            var wikiCss = fs.readFileSync(filesPath + 'amWiki.css', 'utf-8');
            wikiCss = wikiCss
                .replace(/@colour-base/g, config.colour.base)
                .replace(/@colour-light/g, config.colour.light)
                .replace(/@colour-dark/g, config.colour.dark);
            fs.writeFileSync(outputPath + 'amWiki/css/amWiki.css', wikiCss, 'utf-8');

            //拷贝页面资源
            var hasLibrary = createDir(outputPath);
            var fileList = [
                ['markdownbody.github.css', 'amWiki/css/markdownbody.github.css'],
                ['lhjs.github-gist.css', 'amWiki/css/lhjs.github-gist.css'],
                ['forEach.js', 'amWiki/js/forEach.js'],
                ['gbk.js', 'amWiki/js/gbk.js'],
                ['flowchart.min.js', 'amWiki/js/flowchart.min.js'],
                ['raphael-min.js', 'amWiki/js/raphael-min.js'],
                ['jquery-1.11.3.min.js', 'amWiki/js/jquery-1.11.3.min.js'],
                ['marked.min.js', 'amWiki/js/marked.min.js'],
                ['highlight.min.js', 'amWiki/js/highlight.min.js'],
                ['amWiki.js', 'amWiki/js/amWiki.js'],
                ['amWiki-testing.js', 'amWiki/js/amWiki-testing.js'],
                ['icons.svg', 'amWiki/images/icons.svg'],
                ['logo.png', 'amWiki/images/logo.png'],
                ['menubar_bg.png', 'amWiki/images/menubar_bg.png']
            ];
            for (var i = 0; i < fileList.length; i++) {
                copyFile(filesPath + fileList[i][0], outputPath + fileList[i][1]);
            }

            //如果没有library则复制一套默认文档
            if (!hasLibrary) {
                var home = fs.readFileSync(filesPath + 'home.md', 'utf-8');
                home = home.replace('{{name}}', config.name);
                fs.writeFileSync(outputPath + 'library/首页.md', home, 'utf-8');
                var fileList2 = [
                    ['../README.md', 'library/01-关于amWiki/001-了解amWiki文库.md'],
                    ['markdown.md', 'library/02-学习markdown/001-Markdown快速开始.md'],
                    ['highlighting.md', 'library/02-学习markdown/002-Markdown与语法高亮.md'],
                    ['atommd.md', 'library/02-学习markdown/003-Atom默认对markdown的支持.md'],
                    ['apidemo.md', 'library/03-文档示范/001-通用API接口文档示例.md'],
                    ['longarticle.md', 'library/03-文档示范/002-超长文档页内目录示例.md']
                ];
                for (var j = 0; j < fileList2.length; j++) {
                    copyFile(filesPath + fileList2[j][0], outputPath + fileList2[j][1]);
                }
            }

            //更新导航
            updateNav.refresh(outputPath + 'library/');
            //添加监听
            autoNav.watcher(outputPath + 'library/');

            callback && callback(outputPath + 'library/');

        });
    }
};