KOJS.namespace("util");

/**
 * レシピの内容を保持するオブジェクト
 */
KOJS.util.Logger = (function () {
  // ネームスペース省略用のローカル変数
  var Logger, ConsoleLogger, PhoneGapLogger;
  
  Logger = {
    _logger: undefined,
  
    /**
     * 実際に使用するロガーをセットする.
     * 
     * @param {Logger} logger ロガー
     */
    set: function (logger) {
      this._logger = logger;
    },
    
    /**
     * 使用されているロガーを返す.
     * 
     * @return {Logger} 使用されているロガー
     */
    get: function () {
      if (!this._logger) {
        this._logger = new ConsoleLogger();
      }
      return this._logger;
    },
    
    /**
     * ログに記録するための時刻文字列を得る.
     * 
     * @return {String} 時刻文字列
     */
    _time: function () {
      var dt = new Date(),
          hh, mm, ss, dd;
          
      hh = "0" + dt.getHours();
      hh = hh.substring(hh.length - 2);
      mm = "0" + dt.getMinutes();
      mm = mm.substring(mm.length - 2);
      ss = "0" + dt.getSeconds();
      ss = ss.substring(ss.length - 2)
      dd = "00" + dt.getMilliseconds();
      dd = dd.substring(dd.length - 3);
      
      return hh + ":" + mm + ":" + ss + "." + dd;
    },
    
    /**
     * コンソール出力を行うロガーの新規オブジェクトを返す.
     * 
     * @return {Logger} コンソール出力を行うロガー
     */
    consoleLogger: function () {
      return new ConsoleLogger();
    },
    
    /**
     * PhoneGap用のロガーの新規オブジェクトを返す.
     * 
     * @return {Logger} PhoneGap用のロガー
     */
    phoneGapLogger: function () {
      return new PhoneGapLogger();
    }
  };
  
  /**
   * コンソール出力を行うロガーのコンストラクタ
   */
  ConsoleLogger = function () {};
  
  ConsoleLogger.prototype = {
    constructor: ConsoleLogger,
    
    /**
     * 時刻文字列とともに指定のメッセージをログに出力する.
     * 
     * @param {String} message 出力対象のメッセージ
     */
    log: function (message) {
      if (console) {
        console.log(Logger._time() + " " + message);
      }
    }
  };

  /**
   * PhoneGap用のロガーのコンストラクタ
   * devicereadyイベント発生前は配列に保存しておき、
   * イベント発生時にまとめてコンソールに出力する.
   * それ以降は単純にコンソールに出力する.
   */
  PhoneGapLogger = function () {
    this._logs = [];
    this._deviceReady = false;
  };
  
  PhoneGapLogger.prototype = {
    constructor: PhoneGapLogger,
    
    /**
     * 時刻文字列とともに指定のメッセージをログに出力する.
     * 
     * @param {String} message 出力対象のメッセージ
     */
    log: function (message) {
      var text = Logger._time() + " " + message;
      if (this._deviceReady) {
        console.log(text);
      } else {
        this._logs.push(Logger._time() + " " + message);      
      }
    },
    
    /**
     * devicereadyイベントが発生したことを通知する.
     */
    deviceReady: function () {
      console.log(this._logs.join("\n"));
      this._deviceReady = true;
      this._logs = [];
    }
  };
  
  return Logger;
}());



