// based on:
// lucagrulla/node-tail
// https://github.com/lucagrulla/node-tail

var timer, Tail, environment, events, fs,
  boundMethodCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new Error('Bound instance method accessed before binding');
    }
  };
  
events = require("events");

fs = require('fs');

environment = process.env['NODE_ENV'] || 'development';

Tail = class Tail extends events.EventEmitter {

  readBlock() {
    if (this.logger) this.logger.info(`<readBlock>`);
    if (this.separator) this.logger.info(`separator: ${this.separator.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/[^\x20-\x7E]/g, '_')}`);
    var block, stream;

    boundMethodCheck(this, Tail);

    if (this.queue.length >= 1) {
      block = this.queue[0];
      if (block.end > block.start)
      {
        stream = fs.createReadStream(this.filename, {
          flags: 'r', // 'rx' 'r+'
          encoding: this.encoding,
          start: block.start,
          end: block.end - 1,
          autoClose: true
        });

        stream.on('error', (error) => {
          if (this.logger) this.logger.info(`<error>`);
          if (this.logger) this.logger.error(`Tail error: ${error}`);
          return this.emit('error', error);
        });

        stream.on('end', () => {
          if (this.logger) this.logger.info(`<end>`);
          var x;
          x = this.queue.shift();
          if (this.queue.length > 0) this.internalDispatcher.emit("next");
          if (this.flushAtEOF && this.buffer.length > 0) {
            if (this.logger) this.logger.info(`end line: (${this.buffer.length}) '${this.buffer.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/[^\x20-\x7E]/g, '\\_').substr(0,60)}'`);
            this.emit("line", this.buffer);
            return this.buffer = '';
          }
          if (this.logger) this.logger.info(`end buffer: (${this.buffer.length}) '${this.buffer.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/[^\x20-\x7E]/g, '\\_').substr(0,60)}'`);
        });

        return stream.on('data', (data) => {
          if (this.logger) this.logger.info(`<data>`);
          var chunk, i, len, parts, results, pos;

          if (this.mode && this.rememberLast)
          {
            if (this.logger) {
              this.logger.info(`last: (${this.last.length}) '${this.last.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/[^\x20-\x7E]/g, '\\_').substr(-60)}'`);
              this.logger.info(`data.length: ${data.length}`);
            }

            if ((this.last.length > 0) && (data.length >= this.last.length)) {
              pos = data.indexOf(this.last);
              if (pos !== -1) pos = pos + this.last.length;
            }

            this.last = data.slice(-1024);

            if (pos >= 0) {
              if (this.logger) this.logger.info(`pos: ${pos}`);
              data = data.slice(pos);
              if (this.logger) this.logger.info(`new data.length: ${data.length}`);
            }

            if (this.logger) this.logger.info(`new last: (${this.last.length}) '${this.last.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/[^\x20-\x7E]/g, '\\_').substr(-60)}'`);
          }
          
          
          if (!this.separator) {
            return this.emit("line", data);
          }
          else {
            this.buffer += data;
            parts = this.buffer.split(this.separator);
            this.buffer = parts.pop();
            results = [];
            for (i = 0, len = parts.length; i < len; i++) {
              chunk = parts[i];
              if (this.logger) this.logger.info(`data chunk: (${chunk.length}) '${chunk.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/[^\x20-\x7E]/g, '\\_')}'`);
              results.push(this.emit("line", chunk));
            }
            return results;
          }

          if (this.logger) this.logger.info(`data buffer: (${this.buffer.length}) '${this.buffer.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/[^\x20-\x7E]/g, '\\_')}'`);
        });
      }
    }
  }

  constructor(filename, options = {}) {
    var fromBeginning;
    super(filename, options);
    this.readBlock = this.readBlock.bind(this);
    this.change = this.change.bind(this);
    this.filename = filename;
    
    ({
      logger: this.logger, 
      fsWatchOptions: this.fsWatchOptions = {}, 
      encoding: this.encoding = "utf-8", 
      separator: this.separator = /[\r]{0,1}\n/,
      flushAtEOF: this.flushAtEOF = false, 
      fromBeginning = false, 
      maxBytes: this.maxBytes = 0, 
      mode: this.mode = "", 
      rememberLast: this.rememberLast = false
    } = options);

    if (this.logger) {
      this.logger.info(`<constructor>`);
      this.logger.info(`fsWatchOptions: ${JSON.stringify(this.fsWatchOptions)}`);
      this.logger.info(`filename: ${this.filename}`);
      this.logger.info(`encoding: ${this.encoding}`);
      if (this.separator) this.logger.info(`separator: ${this.separator.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/[^\x20-\x7E]/g, '_')}`);
      this.logger.info(`flushAtEOF: ${this.flushAtEOF}`);
      if (this.maxBytes) this.logger.info(`maxBytes: ${this.maxBytes}`);
      if (this.mode) this.logger.info(`mode: ${this.mode}`);
      if (this.mode) this.logger.info(`rememberLast: ${this.rememberLast}`);
    }

    this.online = true;
    this.buffer = '';
    this.last = '';
    this.internalDispatcher = new events.EventEmitter();
    this.queue = [];
    this.isWatching = false;
    this.internalDispatcher.on('next', () => {
      return this.readBlock();
    });

    this.start(fromBeginning);
  }

  start(fromBeginning) {
    if (this.logger) this.logger.info("<start>");
    var interval = 0;
    var timing = function () {
      timer = setInterval(function () {
        if (this.logger) this.logger.info(`tick... interval: ${interval}`);
        if (!fs.existsSync(this.filename)) {
          if (interval == 0) {
            this.emit("noent");
            interval = 1000;
            clearInterval(timer);
            timing();
          }
          return;
        }
        clearInterval(timer);
        if (interval !== 0) this.emit("reappears");

        this.watch(fromBeginning);

      }.bind(this), interval);
    }.bind(this)
    timing();
  }

  change(filename) {
    if (this.logger) this.logger.info(`<change>`);
    var err, stats;
    boundMethodCheck(this, Tail);
    try {
      stats = fs.statSync(filename);
    } catch (error1) {
      err = error1;
      if (this.logger) this.logger.error(`'${e}' event for ${filename}. ${err}`);
      this.emit("error", `'${e}' event for ${filename}. ${err}`);
      return;
    }
    if (stats.size < this.pos) { //scenario where texts is not appended but it's actually a w+
      this.pos = stats.size;
    }
    if (stats.size > this.pos) {
      this.queue.push({
        start: this.pos,
        end: stats.size
      });
      this.pos = stats.size;
      if (this.queue.length === 1) return this.internalDispatcher.emit("next");
    }
  }

  watch(fromBeginning) {
    if (this.logger) this.logger.info("<watch>");
    var err, stats;

    if (this.isWatching) return;
    this.isWatching = true;
    if (this.logger) this.logger.info(`fromBeginning: ${fromBeginning}`);
    
    try {
      stats = fs.statSync(this.filename);
    }
    catch (error1) {
      err = error1;
      if (this.logger) this.logger.error(`watch for ${this.filename} failed: ${err}`);
      this.emit("error", `watch for ${this.filename} failed: ${err}`);
      return;
    }

    this.pos = fromBeginning ? 0 : stats.size;
    if (this.pos === 0) this.change(this.filename);

    if (this.logger) this.logger.info(`following file: ${this.filename}`);

    return fs.watchFile(this.filename, this.fsWatchOptions, (curr, prev) => {
      return this.watchFileEvent(curr, prev);
    });
  }

  watchFileEvent(curr, prev) {
    if (this.logger) {
      this.logger.info(`--------------------------- ${new Date().getTime()}`);
      if (this.mode) this.logger.info(`mode: ${this.mode}`);
    }

    if (curr.ino > 0) {
      if (!this.online) this.emit("reappears");
    }
    else if (this.online) this.emit("disappears");
    this.online = (curr.ino > 0);


    var maxbytes = this.maxBytes || curr.size;
    if (this.logger) this.logger.info(`maxbytes: ${maxbytes}`);

    if (curr.ino > 0) {
      if (this.mode) {
        // this.queue = [];
        // this.buffer = '';

        this.pos = curr.size;
        // if (curr.size > 0) {
          this.queue.push({
            start: (curr.size > maxbytes) ? curr.size - maxbytes : 0,
            end: curr.size
          });
          if (this.queue.length === 1) return this.internalDispatcher.emit("next");
        // }
        // else this.last = '';
      }
      else {
        if (this.logger) {
          // this.logger.info(`prev: ${JSON.stringify(prev, null, 2)}`);
          // this.logger.info(`curr: ${JSON.stringify(curr, null, 2)}`);
          this.logger.info(`prev: ${JSON.stringify({
            "dev": prev.dev,
            "ino": prev.ino,
            "size": prev.size
          }, null, 2)}`);
          this.logger.info(`curr: ${JSON.stringify({
            "dev": curr.dev,
            "ino": curr.ino,
            "size": curr.size
          }, null, 2)}`);
          // this.logger.info(`prev.ino: ${prev.ino+""}`);
          // this.logger.info(`curr.ino: ${curr.ino+""}`);
        }

        if (curr.size > prev.size) {
          if ((this.queue.length === 0) && (this.buffer.length > 0) && !((prev.size - this.buffer.length) < 0)) {
            prev.size = prev.size - this.buffer.length;
            this.buffer = '';
          }

          this.pos = curr.size;
          this.queue.push({
            start: ((curr.size - prev.size) > maxbytes) ? curr.size - maxbytes : prev.size, // prev.size,
            end: curr.size
          });
          if (this.queue.length === 1) return this.internalDispatcher.emit("next");
        }
        else {
          if (curr.size < prev.size) {
            this.pos = curr.size;
            this.queue = [];
            this.buffer = '';
            this.emit("truncated");
          } 
          else {
            if ((this.queue.length === 0) && (this.buffer.length > 0) && !((prev.size - this.buffer.length) < 0)) {
              prev.size = curr.size - this.buffer.length;
              this.buffer = '';

              this.pos = curr.size;
              this.queue.push({
                start: prev.size,
                end: curr.size
              });
              if (this.queue.length === 1) return this.internalDispatcher.emit("next");
            }
          }
        }
      }
    }
  }

  unwatch() {
    if (this.logger) this.logger.info(`<unwatch>`);
    if (timer) clearInterval(timer);
    if (this.isWatching) fs.unwatchFile(this.filename);
    this.isWatching = false;
    this.queue = [];
    this.buffer = '';
    this.last = '';
    if (this.logger) return this.logger.info(`unwatch: ${this.filename}`);
  }
};

exports.Tail = Tail;
