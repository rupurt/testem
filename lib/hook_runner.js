'use strict';

var template = require('./strutils').template;
var Process = require('did_it_work');
var log = require('npmlog');

var envWithLocalPath = require('./env-with-local-path');

function HookRunner(config, Proc) {
  this.config = config;
  this.Process = Proc || Process;
}
HookRunner.prototype = {
  run: function(hook, data, callback) {
    var hookCfg = this.config.get(hook);
    if (!hookCfg) {
      return callback(null);
    }
    var cwd = this.config.get('cwd');
    var command;
    var exe;
    var args;
    var waitForText;
    var waitForTextTimeout;
    var badText;
    var badTextTimeout;

    if (typeof hookCfg === 'function') {
      hookCfg(this.config, data, callback);
      return;
    } else if (typeof hookCfg === 'object') {
      command = hookCfg.command;
      exe = hookCfg.exe;
      args = hookCfg.args;
      waitForText = hookCfg.wait_for_text;
      waitForTextTimeout = hookCfg.wait_for_text_timeout;
      badText = hookCfg.bad_text;
      badTextTimeout = hookCfg.bad_text_timeout;
    } else if (typeof hookCfg === 'string') {
      command = hookCfg;
    }
    waitForTextTimeout = waitForTextTimeout || 10000;
    badTextTimeout = badTextTimeout || waitForTextTimeout;
    var proc;
    if (command) {
      command = this.varsub(command, data);
      proc = this.Process(command);
    } else if (exe) {
      args = this.varsub(args || []);
      proc = this.Process(exe, args);
      command = exe + ' ' + args.join(' ');
    } else {
      throw new Error('No command or exe/args specified for hook ' + hook);
    }
    this.process = proc;

    var exited = false;

    log.info("===== BEFORE RUNNING PROCESS ===========");

    proc
      .options({cwd: cwd, env: envWithLocalPath()})
      .good(function(stdout) {
        if (stdout) {
          log.info(stdout);
        }
        log.info("========= IN GOOD - stdout data: %o ==============", stdout);

        if (exited) {
          return;
        }
        exited = true;
        callback(null);
      })
      .bad(function(err) {
        if (err) {
          log.info(err);
        }
        log.info("========= IN err - stderr data: %o ==============", err);

        proc.kill();
        if (exited) {
          return;
        }
        exited = true;
        callback(err);
      })
      .complete(function(err, stdout, stderr) {
        if (stdout) {
          log.info(stdout);
        }
        if (stderr) {
          log.error(sterr);
        }
        log.info("========= IN COMPLETE - stdout: %o ==============", stdout);
        log.info("========= IN COMPLETE - stderr: %o ==============", stdout);
        log.info("========= IN COMPLETE - err: %o ==============", err);



        if (exited) {
          return;
        }
        exited = true;
        err = err ? {
          name: hook + ' hook: "' + command + '"',
          message: err.message,
          stdout: stdout,
          stderr: stderr
        } : null;
        callback(err, stdout, stderr);
      });
    if (waitForText) {
      log.info("========= WAIT FOR TEST: %o ==============", waitForText);
      proc.goodIfMatches(this.varsub(waitForText), waitForTextTimeout);
    }
    if (badText) {
      log.info("========= BAD TEXT: %o ==============", waitForText);
      proc.badIfMatches(this.varsub(badText), badTextTimeout);
    }
  },
  varsubParams: function() {
    return {
      host: this.config.get('host'),
      port: this.config.get('port'),
      url: this.config.get('url')
    };
  },
  varsub: function(thing, data) {
    if (Array.isArray(thing)) {
      return thing.map(function(str) {
        return this.varsub(str, data);
      }, this);
    } else {
      thing = template(thing, this.varsubParams());
      thing = data ? template(thing, data) : thing;
      return thing;
    }
  },
  stop: function() {
    if (this.process) {
      this.process.kill();
    }
  }
};

module.exports = HookRunner;
