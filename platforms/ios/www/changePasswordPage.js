KOJS.namespace("recipe.page");

/**
 * パスワード変更ページに関する処理をまとめたオブジェクト
 */
KOJS.recipe.page.ChangePasswordPage = (function () {
  var ChangePasswordPage = {
    /**
     * パスワード変更ページの初期化
     * 
     * @param {Context} context アプリケーション共有情報
     */
    setup: function (context) {      
      var self = this,
          logger = KOJS.util.Logger.get();
      
      // パスワード変更ページの初回表示時のイベントの定義
      $("#changepassword-page").on("pagebeforecreate", function (event) {
        // 登録ボタン押下
        $("#cp-commit").on("click", function(e) {
          // 入力チェック
          var oldpassword = $("#cp-oldpassword").val().trim(),
              password1 = $("#cp-password1").val().trim(),
              password2 = $("#cp-password2").val().trim();
          if (!oldpassword.length || !password1.length || !password2.length) {
            alert("全ての項目を入力して下さい。");
          } else if (password1 !== password2) {
            alert("パスワードが食い違っています。");
          } else {
            var user = KiiUser.getCurrentUser(), 
                msg;
            try {
              user.updatePassword(oldpassword, password1, {
                success: function(user) {
                  msg = "パスワードが変更されました。"
                  alert(msg);
                  
                  //$("#changepassword-page").dialog("close");
                  $.mobile.changePage("#list-page", {changeHash: false});
                },

                failure: function(user, errorString) {
                  msg = "パスワードの変更に失敗しました。" + errorString;
                  alert(msg);
                }
              });
            } catch (e) {
              msg = "パスワードの変更に失敗しました。" + e;
              alert(msg);
            }
          }
        });
        
        // キャンセルボタン押下
        $("#cp-cancel").on("click", function(e) {
          //$("#changepassword-page").dialog("close");
          $.mobile.changePage("#list-page", {changeHash: false});
        });
      });
    }
  }

  return ChangePasswordPage;
}());

