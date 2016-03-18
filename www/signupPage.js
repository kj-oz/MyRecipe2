KOJS.namespace("recipe.page");

/**
 * サインアップページに関する処理をまとめたオブジェクト
 */
KOJS.recipe.page.SignupPage = (function () {
  var SignupPage = {
    
    /**
     * サインアップページの初期化
     * 
     * @param {Context} context アプリケーション共有情報
     */
    setup: function (context) {
      if (this._initialized) {
        return;
      }
      
      var self = this,
          logger = KOJS.util.Logger.get();
      
      // サインアップページの初回表示時のイベントの定義
      $("#signup-page").on("pagebeforecreate", function (event) {
        // 登録ボタン押下
        $("#su-signup").on("click", function(e) {
          // 入力チェック
          var mailaddress = $("#su-mailaddress").val().trim(),
              password1 = $("#su-password1").val().trim(),
              password2 = $("#su-password2").val().trim();
          if (!mailaddress.length || !password1.length || !password2.length) {
            alert("全ての項目を入力して下さい。");
          } else if (password1 !== password2) {
            alert("パスワードが食い違っています。");
          } else {
            var user, msg, 
                userId = mailaddress.replace("@", "--")
            try {
              user = KiiUser.userWithEmailAddressAndUsername(mailaddress, 
                              userId, password1);
              user.register({
                success: function(user) {
                  var msg = "指定されたメールアドレスに登録処理用のメールをお送りしました。" +
                            "そのメールの内容に従って登録処理を完了して下さい。"
                  alert(msg);
                  
                  context.signupped = true;
                  
                  // 2重にダイアログを表示するとうまく閉じることが出来ないため、
                  // 直接ログインページに遷移
                  //$("#signup-page").dialog("close");
                  $.mobile.changePage("#login-page", {changeHash: false, role: "dialog"});
                },

                failure: function(user, errorString) {
                  var msg;
                  if (errorString.indexOf("USER_ALREADY_EXISTS") >= 0) {
                    msg = "そのユーザーは既に登録されています。";
                  } else {
                    msg = "ユーザー登録できませんでした。" + errorString;
                  }
                  alert(msg);
                }
              });
            } catch (e) {
              msg = "メールアドレスかパスワードが不正です。ご確認ください。\n" +
                        "パスワードは４文字以上、半角英数字か@,#,$,%,^,&のみ" +
                        "使用可能です。"
              alert(msg);
            }
          }
        });
        
        // キャンセルボタン押下
        $("#su-cancel").on("click", function(e) {
          // 2重にダイアログを表示するとうまく閉じることが出来ないため、
          // 直接ログインページに遷移
          //$("#signup-page").dialog("close");
          $.mobile.changePage("#login-page", {changeHash: false, role: "dialog"});
        });
      });
    }
  }

  return SignupPage;
}());

