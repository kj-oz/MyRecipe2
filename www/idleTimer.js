(function () {
  var _status,
      _timerId;

  /**
   * アイドルタイマー無効化プラグイン用のJavaScriptインターフェースを生成する.
   * @class PhoneGapのアイドルタイマー無効化プラグイン用のJavaScriptインターフェース
   */
  function IdleTimer() {}

  /**
   * アイドルタイマーを有効にする.
   *
   * @param {Function(result:Object):void} successFunc 成功時コールバック
   * @param {Function(error:Object):void} errorFunc 失敗時コールバック
   */
  IdleTimer.prototype.enable = function (successFunc, errorFunc) {
    this.setIdleTimer(successFunc, errorFunc, "enabled", 0);
  };

  /**
   * アイドルタイマーを無効にする.
   *
   * @param {Number} period 無効化の持続時間（分数）
   * @param {Function(result:Object):void} successFunc 成功時コールバック
   * @param {Function(error:Object):void} errorFunc 失敗時コールバック
   */
  IdleTimer.prototype.disable = function (period, successFunc, errorFunc) {
    this.setIdleTimer(successFunc, errorFunc, "disabled", period);
  };

  /**
   * アイドルタイマーの状態を得る.
   *
   * @param {Function(result:Object):void} successFunc 成功時コールバック
   *    resultに現在の状態が返る
   * @param {Function(error:Object):void} errorFunc 失敗時コールバック
   */
  IdleTimer.prototype.get = function (successFunc, errorFunc) {
    this.setIdleTimer(successFunc, errorFunc, "", 0);
  };

  /**
   * アイドルタイマーの状態を変更し変更後の状態を得る.
   *
   * @param {Function(result:Object):void} successFunc 成功時コールバック
   * @param {Function(error:Object):void} errorFunc 失敗時コールバック
   * @param {String} status 変更後の状態 "enabled"=有効、"disabled"=無効、""=変更せずに調べるのみ
   * @param {Number} period 無効化の持続時間（分数）
   */
  IdleTimer.prototype.setIdleTimer = function(successFunc, errorFunc, status, period) {
    if (window.cordova && window.cordova.exec) {
      console.log("idletimer " + status);
      if (status === "") {
        return _status;
      } else {
        if (_timerId) {
          window.clearTimeout(_timerId)
          _timerId = undefined;
        }
        if (status === "disabled") {
          window.powerManagement.acquire(successFunc, errorFunc);
          _timerId = window.setTimeout(function() {
            window.powerManagement.release(function() {}, function() {});
            _timerId = undefined;
          }, period * 60 * 1000);
        } else {
          window.powerManagement.release(successFunc, errorFunc);
        }
        _status = status
      }
    }
  };

  if (!window.plugins) {
    window.plugins = {};
  }
  window.plugins.idleTimer = new IdleTimer();
})();
