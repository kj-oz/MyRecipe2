KOJS.namespace("recipe.page");

/**
 * ログインページに関する処理をまとめたオブジェクト
 */
KOJS.recipe.page.LoginPage = (function () {
  var LoginPage = {
    // 初期化済みフラグ
    _initialized: false,
    
    // ログイン失敗の通算回数
    _failureCount: 0,
    
    // 表示時に初期化されるDeferredオブジェクト
    _deferred: null,
    
    // 終了時の戻り先ページ（dialog.close()が適切に動作しないため）
    _fromPage: null,
    
    /**
     * ログインページの初期化
     * 
     * @param {Context} context アプリケーション共有情報
     */
    setup: function (context) {
      if (this._initialized) {
        return;
      }
      
      var self = this,
          logger = KOJS.util.Logger.get();
      
      // ログインページの初回表示時のイベントの定義
      $("#login-page").on("pagebeforecreate", function (event) {
        // ログインボタン押下
        $("#lg-login").on("click", function(e) {
          // 入力チェック
          var mailaddress = $("#lg-mailaddress").val().trim(),
              password = $("#lg-password").val().trim();
          if (!mailaddress.length || !password.length) {
            alert("全ての項目を入力して下さい。");
          } else {
            logger.log("- authenticate start");
            KiiUser.authenticate(mailaddress, password, {
              success: function(user) {
                context.saveUser(user);
                // $(".ui-dialog").dialog("close");
                logger.log("- authenticate done > changePage " + self._fromPage);
                $.mobile.changePage(self._fromPage, {changeHash: false});
                logger.log("- loginPage resolve");
                self._deferred.resolve();
              },

              failure: function(user, errorString) {
                var msg = "ログインできません。";
                
                if (context.signupped) {
                  msg += "\nまず最初に、指定のメールアドレスに送られた登録手続きの" +
                            "メールに従ってユーザー登録の手続きを完了させて下さい。"
                }
                alert(msg);
                self._failureCount++;
                if (self._failureCount >= 3) {
                  $("#lg-login").attr("disabled","disabled");  
                }
              }
            });
          }
        });
        
        // キャンセルボタン押下
        $("#lg-cancel").on("click", function(e) {
          // $(".ui-dialog").dialog("close");では起動前の画面に戻ってしまうため、以下に変更
          logger.log("- loginPage canceled > changePage " + self._fromPage);
          $.mobile.changePage(self._fromPage, {changeHash: false});
          logger.log("- loginPage reject");
          self._deferred.reject();
        });
        
        // 新規登録リンク押下
        $("#lg-signup").on("click", function(e) {
          var msg = "以下の文章に同意していただける場合のみ「OK」ボタンをタップして" +
                    "ユーザー登録を続けて下さい。\n" +
                    "\n" +
                    "　本サービスは無料でご利用いただけますが、登録可能なレシピ数は" +
                    "１利用者あたり最大500程度とします。\n" +
                    "　本サービスに登録されたユーザーIDやレシピデータを、運営者が故意に" +
                    "本サービスの提供以外の目的で利用することはありませんが、" +
                    "何らかの原因でそれらのデータが漏洩や消失した場合、あるいは改竄された場合にも、" +
                    "運営者は利用者に対して一切責任を負いません。\n" +
                    "　本サービスを利用したことによる、あるいは利用できなかったことによる" +
                    "何らかの損害が発生した場合にも、" +
                    "運営者は利用者に対して一切責任を負いません。\n" +
                    "　本サービスは特に利用者に通知することなく内容変更や停止または中止" +
                    "することがあります。予めご了承ください。\n" +
                    "\n" +
                    "以上"
          if (confirm(msg)) {
            context.signupped = false;
            $.mobile.changePage("#signup-page", {changeHash: false, role: "dialog"});
          }
        });
        
        // パスワードリセット
        $("#lg-resetpassword").on("click", function(e) {
          KiiUser.resetPassword($("#lg-mailaddress").val().trim(), {
            success: function(user) {
              var msg = "登録されたメールアドレスにパスワードリセット処理用のメールをお送りしました。" +
                        "そのメールの内容に従ってリセット処理を完了して下さい。"
              alert(msg);
            },

            failure: function(user, errorString) {
              var msg = "パスワードリセット手続きができませんでした。" +
                        "メールアドレスが正しいことをご確認の上、再度お試しください。"
              alert(msg);
            }
          });
        });
      });
      
      // ログインページ表示時のイベントの定義
      $("#login-page").on("pagebeforeshow", function (event) {
        $("#lg-mailaddress").val(localStorage["mailAddress"]);
        if (self._failureCount >= 3) {
          $("#lg-login").attr("disabled","disabled");  
        }
      });      
    },
    
    /**
     * ログインページの表示
     * 
     * @param {fromPage} 戻り先ページのID
     * @return {Promise} 処理に対するPromiseオブジェクト
     *  成功時のコールバックの引数は空
     */
    show: function (fromPage) {
      var logger = KOJS.util.Logger.get();
      
      logger.log("- loginPage start");
      this._deferred = $.Deferred();
      this._fromPage = fromPage;
      $.mobile.changePage("#login-page", {changeHash: false, role: "dialog"});
      logger.log("- loginPage return");
      return this._deferred.promise();
    }
  }

  return LoginPage;
}());

