KOJS.namespace("util");

/**
 * パスワードなどを保持するオブジェクト
 */
KOJS.util.Secret = (function () {
  // ネームスペース省略用のローカル変数
  var Secret;

  Secret = {
    /**
     * KiiCloudのAppIDを返す.
     *
     * @return {String} AppID
     */
    getKiiAppId: function () {
      return "6b909370";
    },

    /**
     * KiiCloudのAppAccessKeyを返す.
     *
     * @return {String} AppAccessKey
     */
    getKiiAppAccessKey: function () {
      return "7ff717dad74bc0f667f307676f0fd270";
    }
  };

  return Secret;
}());
