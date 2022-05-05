KOJS.namespace("recipe.page");

/**
 * 編集ページに関する処理をまとめたオブジェクト
 */
KOJS.recipe.page.EditPage = (function () {
  var EditPage = {
    // 初期化済みフラグ
    _initialized: false,

    /**
     * 編集ページの初期化
     *
     * @param {Context} context アプリケーション共有情報
     */
    setup: function (context) {
      if (this._initialized) {
        return;
      }

      var self = this,
          tabPressed = false;

      // 編集ページ初回表示時イベントの定義
      $("#edit-page").on("pagebeforecreate", function (event) {

        // ナビゲーションのボタンイベントの定義
        $("#ed-btn-cancel").on("click", function (event) {
          context.endEditing();
        });

        $("#ed-btn-done").on("click", function (event) {
          var recipe = context.editingRecipe;
          self._getRecipeFromForm();

          if (recipe.title === "") {
            alert("タイトルを入力して下さい。");
           return;
          }
          if (recipe.ingredients.length == 0) {
            alert("材料を入力して下さい。");
            return;
          }
          if (recipe.steps.length == 0) {
            alert("手順を入力して下さい。");
            return;
          }

          context.commitEditing();
        });

        // 出典入力欄のイベントの定義
        $("#ed-source").on("change",  function (e) {
          var $input = $(e.target), match, url;

          // C1234形式ならクックパッド呼び出し
          match = $input.val().match(/(^[Cc]\s?)(\d+$)/);
          if (match && $("#ed-title").val().trim() === "") {
            $.mobile.showPageLoadingMsg();
            url = context.getServerPath() + "/cp/" + match[2];
            self._queryCookpad(url).always(function () {
              $.mobile.hidePageLoadingMsg();
            });
          }
        });

        // 材料削除・挿入ボタンのイベントの定義
        $("#ed-ingredients-table").on("click", "button",  function (e) {
          var $button = $(e.target),
              rowIndex,
              $row,
              emptyIngredient = {name:"", quantity:""};

          e.preventDefault();
          $row = $button.closest("tr");
          rowIndex = $("#ed-ingredients-table tr").index($row);
          if ($button.hasClass("btn-remove")) {
            if ($("#ed-ingredients-table tr").length > 1) {
              $row.remove();
            }
          } else {
            $row.before(SNBinder.bind(context.templates["ed-ingredients"], emptyIngredient));
            $row = $("#ed-ingredients-table tr:eq(" + rowIndex + ")");
            $row.find("input").textinput();
            $row.find("button").button();
          }
        });

        // 材料入力欄のイベントの定義
        $("#ed-ingredients-table").on("change", "input:text",  function (e) {
          var $input = $(e.target),
              rowIndex,
              $row,
              $rows,
              emptyIngredient = {name:"", quantity:""},
              html;

          e.preventDefault();
          $row = $input.parents("tr");
          $rows = $("#ed-ingredients-table tr");
          rowIndex = $rows.index($row);
          if ($rows.length === rowIndex + 1 && $input.val() != "") {
            html = SNBinder.bind(context.templates["ed-ingredients"], emptyIngredient);
            $("#ed-ingredients-table tbody").append(html);
            $row = $("#ed-ingredients-table tr:last");
            $row.find("input").textinput();
            $row.find("button").button();
          }
        });

        // 手順削除・挿入ボタンのイベントの定義
        $("#ed-steps-table").on("click", "button",  function (e) {
          var $button = $(e.target),
              rowIndex,
              $row,
              emptyStep = {value:""};

          e.preventDefault();
          $row = $button.closest("tr");
          rowIndex = $("#ed-steps-table tr").index($row);
          if ($button.hasClass("btn-remove")) {
            if ($("#ed-steps-table tr").length > 1) {
              $row.remove();
            }
          } else {
            $row = $row.before(SNBinder.bind(context.templates["ed-steps"], emptyStep));
            $row = $("#ed-steps-table tr:eq(" + rowIndex + ")");
            $row.find("textarea").textinput();
            $row.find("button").button();
          }
        });

        // 手順入力欄のイベントの定義
        $("#ed-steps-table").on("change", "textarea",  function (e) {
          var $input = $(e.target),
              rowIndex,
              $row,
              $rows,
              emptyStep = {value:""},
              html;

          e.preventDefault();
          $row = $input.parents("tr");
          $rows = $("#ed-steps-table tr");
          rowIndex = $rows.index($row);
          if ($rows.length === rowIndex + 1 && $input.val() != "") {
            html = SNBinder.bind(context.templates["ed-steps"], emptyStep);
            $("#ed-steps-table tbody").append(html);
            $row = $("#ed-steps-table tr:last");
            $row.find("textarea").textinput();
            $row.find("button").button();
            if (tabPressed) {
              $row.find("textarea").focus();
              tabPressed = false;
            }
          }
        });

        $("#ed-steps-table").on("keydown", "textarea",  function (e) {
          if (e.which === 9) {
            tabPressed = true;
          }
        });
      });

      // 編集ページ表示時のイベントの定義
      $("#edit-page").on("pagebeforeshow", function (event) {
        self._setRecipeToForm();
      });

      /**
       * フォームの内容をeditingRecipeに取り込む
       */
      this._getRecipeFromForm = function () {
        var html,
            i,
            recipe = context.editingRecipe,
            ingredient,
            numIngredients;

        recipe.title = $("#ed-title").val().trim();
        recipe.source = $("#ed-source").val().trim();
        recipe.link = $("#ed-link").val().trim();
        recipe.description = $("#ed-description").val().trim();
        recipe.numPeople = $("#ed-numpeople").val().trim();

        recipe.ingredients = [];
        $("#ed-ingredients-table tr").each(function (index, elem) {
          var jq = $(elem);
          recipe.ingredients.push({
            name: jq.find(".input-name").val().trim(),
            quantity: jq.find(".input-quantity").val().trim()
          });
        });
        numIngredients = 0;
        for (i = recipe.ingredients.length - 1; i >= 0; i--) {
          ingredient = recipe.ingredients[i];
          if (ingredient.name != "" || ingredient.quantity != "") {
            if (numIngredients === 0) {
              numIngredients = i + 1;
            }
          } else {
            if (numIngredients > 0) {
              ingredient.name = "　";
            }
          }
        }
        recipe.ingredients.length = numIngredients;

        recipe.memo = $("#ed-memo").val().trim();

        recipe.rank = $("#ed-rank").val();
        recipe.difficulty = $("#ed-difficulty").val();
        recipe.category = $("#ed-category").val();

        recipe.steps = [];
        $("#ed-steps-table tr").each(function (index, elem) {
          recipe.steps.push($(elem).find("textarea").val().trim());
        });
        for (i = recipe.steps.length - 1; i >= 0; i--) {
          if (recipe.steps[i] != "") {
            break;
          }
        }
        recipe.steps.length = i + 1;

        recipe.advise = $("#ed-advise").val().trim();
      };

      /**
       * 指定のurlのCookpadのページの内容を得る.
       */
      this._queryCookpad = function (url) {
        var self = this;

        return $.ajax({
          url: url,
          type: "GET",
          processData: false,
          dataType: "html",
          success: function (data, status) {
            $("#cookpad").html(data);
            self._loadFromCookpad();
          },
          error: function (xhr, status, ex) {
            $("#ed-link").val(ex);
          }
        });
      };

      /**
       * Cookpadのページ(の#recipe以下)読み込み時のハンドラ
       * 内容(#Cookpad以下に取込み済み)を解析し画面に表示
       * 終了後 #Cookpadの下をクリア
       */
      this._loadFromCookpad = function () {
        var self = this, text,
            recipe = context.editingRecipe;

        recipe.title = $("#recipe-title h1").text().trim();
        $("#recipe_author_info_wrapper").remove();
        recipe.description = $("#description .description_text").html().replace(/<br( \/)?>/g, "\n").trim();
        text = $("#ingredients .servings_for").text().trim();
        recipe.numPeople = text.substr(1, text.length - 2);

        recipe.ingredients = [];
        $("#ingredients .ingredient_row").each(function (index, elem) {
          var jq = $(elem);
          recipe.ingredients.push({
            name: jq.find(".ingredient_name").text().trim(),
            quantity: self._toHankaku(jq.find(".ingredient_quantity").text().trim())
          });
        });

        text = $("#ed-source").val().match(/\d+/)[0];
        recipe.source = "クックパッド #" + text;
        recipe.link = "http://cookpad.com/recipe/" + text;

        recipe.steps = [];
        $("#steps .step,.step_last").each(function (index, elem) {
          recipe.steps.push(
                $(elem).find("p").html().replace(/<br( \/)?>/g, "\n").trim());
        });

        recipe.advise = $("#advice").html().replace(/<br( \/)?>/g, "\n").trim();

        self._setRecipeToForm();
        $("#cookpad").empty();
      };

      /**
       * 編集対象レシピの内容をフォームに設定する
       */
      this._setRecipeToForm = function () {
        var html, i, n,
            recipe = context.editingRecipe,
            templates = context.templates;

        $("#ed-title").val(recipe.title);
        $("#ed-description").val(recipe.description).keyup();
        $("#ed-numpeople").val(recipe.numPeople);

        html = SNBinder.bind_rowset(templates["ed-ingredients"], recipe.ingredients);
        html += SNBinder.bind(templates["ed-ingredients"], {name:"", quantity:""})
        $("#ed-ingredients-table tbody").empty().html(html);
        $("#ed-ingredients-table input").textinput();
        $("#ed-ingredients-table button").button();

        $("#ed-memo").val(recipe.memo).keyup();
        $("#ed-rank").val(recipe.rank).slider("refresh");
        $("#ed-difficulty").val(recipe.difficulty).slider("refresh");
        $("#ed-category").val(recipe.category).selectmenu("refresh");
        $("#ed-source").val(recipe.source);
        $("#ed-link").val(recipe.link);

        // SNBinderで置換すると、改行コードが＜br/>に置き換えられてしまうため、
        // 値はプログラム側で設定する
        html = "";
        for (i = 0, n = recipe.steps.length; i < n; i++) {
          html += SNBinder.bind(templates["ed-steps"], {value:""})
        }
        html += SNBinder.bind(templates["ed-steps"], {value:""})
        $("#ed-steps-table tbody").empty().html(html);
        $("#ed-steps-table textarea").each(function (index, elem) {
          if (index < n) {
            $(elem).val(recipe.steps[index]);
          }
        });

        $("#ed-steps-table textarea").textinput().keyup();
        $("#ed-steps-table button").button();

        $("#ed-advise").val(recipe.advise).keyup();
      };

      this._toHankaku = function (sentence) {
        return sentence.replace(/[０１２３４５６７８９]/g, function (num) {
          var i = "０１２３４５６７８９".indexOf(num);
          return (i !== -1) ? i : num;
        });
      }
    }
  }

  return EditPage;
}());
