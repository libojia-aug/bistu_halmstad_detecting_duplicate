const path = require("path");
const fs = require("fs");
const join = require('path').join;
const multipart = require("connect-multiparty");
const events = require("events");
const crypto = require("crypto");
const {
  exec
} = require('child_process');

const _ZERO32 = '0000 0000 0000 0000 0000 0000 0000 0000';
const _ZERO64 = '0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000';
const settings = require("../settings");

module.exports = function(app) {
  app.get("/", function(req, res) {

    res.render("index", {});
  });

  app.get("/detecting", function(req, res) {
    //    /Volumes
    var fileNames = findSync('/Volumes');
    console.log(fileNames);
    res.render("detecting", {});
  });

  app.get("/createimages", function(req, res) {
    //    /Volumes
    var fileNames = findSync('/Volumes');
    console.log(fileNames);
    res.render("detecting", {});
  });

  app.get("/hadimages", function(req, res) {
    //    /Volumes
    let files = findSync('./images');
    console.log(files);
    res.render("hadimages", {
      files: files
    });
  });
  app.post("/run", function(req, res) {
    req.session.image = req.body.image;
    var msg = {
      state: true
    };
    return res.send(msg);
  })

  app.get("/result", function(req, res) {
    let image = req.session.image;
    console.log(image);

    var mbr;

    var partitionTables = new Array(3);
    var vbr = new Array(3);
    var vbrIndex = new Array(3);
    var rootDirectorys = new Array(3);
    var files1 = [];
    var files2 = [];
    var files3 = [];
    var files4 = [];
    var emitter = new events.EventEmitter();

    dd(image, 1, 512, 0, function(err, out) {
      if (err) {
        res.render("run", {});
      }
      // console.log(out);
      mbr = out;
      emitter.emit("mbr");
    });

    dd(image, 16, 1, 446, function(err, out) {
      if (err) {
        res.render("run", {});
      }
      // console.log(out);
      if (out.indexOf(_ZERO32) < 0) {
        partitionTables[0] = out;
        emitter.emit("partitionTables1");
      }

    });
    dd(image, 16, 1, 462, function(err, out) {
      if (err) {
        res.render("run", {});
      }
      // console.log(out);
      if (out.indexOf(_ZERO32) < 0) {
        partitionTables[1] = out;
        emitter.emit("partitionTables2");
      }
    });
    dd(image, 16, 1, 478, function(err, out) {
      if (err) {
        res.render("run", {});
      }
      // console.log(out);
      if (out.indexOf(_ZERO32) < 0) {
        partitionTables[2] = out;
        emitter.emit("partitionTables3");
      }
    });
    dd(image, 16, 1, 494, function(err, out) {
      if (err) {
        res.render("run", {});
      }
      // console.log(out);
      if (out.indexOf(_ZERO32) < 0) {
        partitionTables[3] = out;
        emitter.emit("partitionTables4");
      }
    });


    emitter.addListener("mbr", function() {
      console.log("mbr");
      console.log(mbr);
    });

    emitter.addListener("partitionTables1", function() {
      console.log("partitionTables1");
      console.log(partitionTables[0]);
      vbrGet(partitionTables[0], 1)
    });
    emitter.addListener("partitionTables2", function() {
      console.log("partitionTables2");
      console.log(partitionTables[1]);
      vbrGet(partitionTables[1], 2)
    });
    emitter.addListener("partitionTables3", function() {
      console.log("partitionTables3");
      console.log(partitionTables[2]);
      vbrGet(partitionTables[2], 3)
    });
    emitter.addListener("partitionTables4", function() {
      console.log("partitionTables4");
      console.log(partitionTables[3]);
      vbrGet(partitionTables[3], 4)
    });

    function vbrGet(partitionTable, tag) {
      let ptArr = partitionTable.split(' ')
      let sixteen = ptArr[6].substring(2, 4) + ptArr[6].substring(0, 2) + ptArr[5].substring(2, 4) + ptArr[5].substring(0, 2);
      vbrIndex[tag - 1] = parseInt(sixteen, 16);
      dd(image, 1, 512, vbrIndex[tag - 1], function(err, out) {
        if (err) {
          res.render("run", {});
        }
        // console.log(out);
        vbr[tag - 1] = out;
        emitter.emit("vbr" + tag);
      });
    }

    emitter.addListener("vbr1", function() {
      console.log("vbr1");
      console.log(vbr[0]);
      let skipToRoot = getRoot(vbr[0], vbrIndex[0]);
      getFiles(1, skipToRoot, 1);
    });
    emitter.addListener("vbr2", function() {
      console.log("vbr2");
      console.log(vbr[1]);
      let skipToRoot = getRoot(vbr[1], vbrIndex[1]);
      getFiles(1, skipToRoot, 2);
    });
    emitter.addListener("vbr3", function() {
      console.log("vbr3");
      console.log(vbr[2]);
      let skipToRoot = getRoot(vbr[2], vbrIndex[2]);
      getFiles(1, skipToRoot, 3);
    });
    emitter.addListener("vbr4", function() {
      console.log("vbr4");
      console.log(vbr[3]);
      let skipToRoot = getRoot(vbr[3], vbrIndex[3]);
      getFiles(1, skipToRoot, 4);
    });

    emitter.addListener('rootDirectory1', function(skipToRoot) {
      console.log('rootDirectorys1');
      console.log(rootDirectorys[0]);
      let lines = rootDirectorys[0].split('\n');
      // console.log(lines);
      let times = 0;

      function getFileInfo(filePath, lins) {
        for (var i = 0; i < lins.length - 1; i++) {
          // console.log(lins[i].substring(37, 39));
          switch (lins[i].substring(37, 39)) {
            case '00':
              continue;
            case '10':
              // console.log(lins[i].substring(10, 12))
              if (lins[i].substring(10, 12) == 'e5' || lins[i].substring(10, 12) == '2e') {
                continue;
              } else if (lins[i].substring(10, 12) == '4c') {
                var tempArr = [];
                for (var j = 0; j < 99; j++) {
                  tempArr.push(lins[i - j]);
                  if (lins[i - j].substring(10, 12) == '43') {
                    break;
                  }
                }
                var skipTemp = skipToRoot + (parseInt(tempArr[0].substring(62, 64) + tempArr[0].substring(60, 62) + tempArr[0].substring(77, 79) + tempArr[0].substring(75, 77), 16) - 2) * 4
                times++;
                // var filePathTemp = tempArr[0].substring(89, 98).split(' ').join('');
                let filePathTemp = '';
                for (var k = 1; k < tempArr.length; k++) {
                  filePathTemp += tempArr[k].substring(92, tempArr[k].length);
                }
                filePathTemp = filePathTemp.split('.').join('');
                // console.log(filePathTemp);
                ddWithInfo(image, 1, 512, skipTemp, filePathTemp, function(err, out, info) {
                  times--;
                  getFileInfo(filePath + info + '/', out.split('\n'), skipTemp);
                  // console.log(out);
                })

              } else {
                var skipTemp = skipToRoot + (parseInt(lins[i].substring(62, 64) + lins[i].substring(60, 62) + lins[i].substring(77, 79) + lins[i].substring(75, 77), 16) - 2) * 4
                times++;
                var filePathTemp = lins[i].substring(89, 98).split(' ').join('');
                ddWithInfo(image, 1, 512, skipTemp, filePathTemp, function(err, out, info) {
                  times--;
                  getFileInfo(filePath + info + '/', out.split('\n'), skipTemp);
                  // console.log(out);
                })

              }
            case '16':
              continue;
            case '0f':
              continue;
              // if (lins[i].substring(10, 12) == 'e5') {
              //   continue;
              // } else {

              // }
            case '20':
              if (lins[i].substring(10, 12) == '4c') {
                var tempArr = [];
                for (var j = 0; j < 99; j++) {
                  tempArr.push(lins[i - j]);
                  if (lins[i - j].substring(10, 12) == '43') {
                    break;
                  }
                }
                files1.push(longFileOnly(tempArr, filePath, skipToRoot));
              } else {
                files1.push(fileOnly(lins[i], filePath, skipToRoot));
              }
            default:


          }

        }
        // console.log(times);
        // console.log(files1.length);
        if (times == 0) {
          emitter.emit("file1Get");
        }

      }

      getFileInfo('/', lines, skipToRoot);
      // console.log(files1);
      emitter.addListener("file1Get", function() {
        // console.log("file1Get");
        console.log(files1);
        var times = 0;
        for (var i = 0; i < files1.length; i++) {
          var count = Math.ceil(files1[i][3] / 512.0);
          // console.log(count);
          // console.log(files1[i]);
          ddWithInfo(image, count, 512, files1[i][2], i, function(err, out, info) {
            times++;
            console.log(files1);
            console.log(info);
            // files1[info].push(out);
            var md5 = crypto.createHash('md5');
            var outMd5 = md5.update(out).digest('hex');
            files1[info].push(outMd5);
            if (i == times) {
              emitter.emit("file1Read");
            }
          })
        }
      });

      emitter.addListener("file1Read", function() {
        // console.log("file1Get");
        console.log(files1);
        res.render("result", {
          files1: files1,
          image:req.session.image
        });

      });
    })

    function fileOnly(line, fPath, oldPathNum) {
      let fileName = line.substring(89, 102).split(' ').join('');
      fileName = fileName.substring(0, fileName.length - 3) + '.' + fileName.substring(fileName.length - 3, fileName.length);
      let size = parseInt(line.substring(87, 89) + line.substring(85, 87) + line.substring(82, 84) + line.substring(80, 82), 16);
      let pathNum = oldPathNum + (parseInt(line.substring(62, 64) + line.substring(60, 62) + line.substring(77, 79) + line.substring(75, 77), 16) - 2) * 4;
      return [fPath, fileName, pathNum, size, line]
    }

    function longFileOnly(lines, fPath, oldPathNum) {
      //fileName, path, size, all
      let fileName = '';
      for (var k = 1; k < lines.length; k++) {
        fileName += lines[k].substring(92, lines[k].length);
      }
      fileName = fileName.split('.').join('');
      fileName = fileName.substring(0, fileName.length - 3) + '.' + fileName.substring(fileName.length - 3, fileName.length);
      // console.log(fileName);
      // let size = lines[0].substring(80, 89);
      let size = parseInt(lines[0].substring(87, 89) + lines[0].substring(85, 87) + lines[0].substring(82, 84) + lines[0].substring(80, 82), 16);
      let pathNum = oldPathNum + (parseInt(lines[0].substring(62, 64) + lines[0].substring(60, 62) + lines[0].substring(77, 79) + lines[0].substring(75, 77), 16) - 2) * 4;
      return [fPath, fileName, pathNum, size, lines]
    }

    emitter.addListener('rootDirectory2', function() {
      console.log('rootDirectorys2');
      console.log(rootDirectorys[1]);
    })
    emitter.addListener('rootDirectory3', function() {
      console.log('rootDirectorys3');
      console.log(rootDirectorys[2]);
    })
    emitter.addListener('rootDirectory4', function() {
      console.log('rootDirectorys4');
      console.log(rootDirectorys[3]);
    })

    function getFiles(count, skipToRoot, tag) {
      // console.log('getFiles: ' + count + " " + skipToRoot + ' ' + tag);
      dd(image, count, 512, skipToRoot, function(err, out) {
        if (err) {
          res.render("run", {});
        }
        if (out.indexOf(_ZERO64) < 0) {
          count++;
          return getFiles(count, skipToRoot, tag);
        } else {
          // console.log(out);
          rootDirectorys[tag - 1] = out;
          emitter.emit('rootDirectory' + tag, skipToRoot);
        }
      })
    }

    function getRoot(vbr, vbrIndex) {
      let reserved_index = vbr.indexOf('00000000: ')
      let reserved_sixteen = vbr.substring(reserved_index + 47, reserved_index + 49) + vbr.substring(reserved_index + 45, reserved_index + 47)
      let reserved_ten = parseInt(reserved_sixteen, 16);
      // console.log(reserved_sixteen);
      // console.log(reserved_ten);
      let fat_index = vbr.indexOf('00000020: ')
      let fat_sixteen = vbr.substring(fat_index + 22, fat_index + 24) + vbr.substring(fat_index + 20, fat_index + 22)
      let fat_ten = parseInt(fat_sixteen, 16);
      // console.log(fat_sixteen);
      // console.log(fat_ten)
      return vbrIndex + reserved_ten + 2 * fat_ten;
    }


    // res.render("result", {});
  });

  app.get("/jdInfo", function(req, res) {
    res.render("jdInfo", {});
  });
};



function findSync(startPath) {
  let result = [];

  function finder(path) {
    let files = fs.readdirSync(path);
    for (var i = 0; i < files.length; i++) {
      if (files[i] == 'Macintosh HD' || files[i][0] == '.') {
        continue;
      } else {
        let fPath = join(path, files[i]);
        let stats = fs.statSync(fPath);
        if (stats.isDirectory()) finder(fPath);
        if (stats.isFile()) result.push(fPath);
      }
    }
  }
  finder(startPath);
  return result;
}

function dd(image, count, bs, skip, cb) {
  exec('dd if=' + image + ' count=' + count + ' bs=' + bs + ' skip=' + skip + '|xxd -c 32', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      cb(error);
    }
    // console.log(stdout);
    // console.log(`stdout: ${stdout}`);
    // console.log(`stderr: ${stderr}`);
    cb(null, stdout)
  });
}

function ddWithInfo(image, count, bs, skip, info, cb) {
  exec('dd if=' + image + ' count=' + count + ' bs=' + bs + ' skip=' + skip + '|xxd -c 32', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      cb(error);
    }
    // console.log(stdout);
    // console.log(`stdout: ${stdout}`);
    // console.log(`stderr: ${stderr}`);
    cb(null, stdout, info)
  });
}