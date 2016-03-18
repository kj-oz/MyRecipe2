/**
 * KOが提供するJavaScriptライブラリーのルートモジュール
 * 唯一のグローバルシンボル
 */
var KOJS = KOJS || {};

/**
 * 与えられた文字列の名前空間を（未定義であれば）空オブジェクトとして定義する
 *
 * @param {String} path 名前空間を定義する文字列
 * 　先頭の KOJS は省略可能
 * 　例 "KOJS.project1.catrgory1.Function11"
 * @return {Object} 名前空間の指し示すオブジェクト
 */
KOJS.namespace = function (path) {
	var parts = path.split("."),
		parent = KOJS,
		i, n;

	// 先頭のKOPSを取り除く
	if (parts[0] === "KOJS") {
		parts = parts.slice(1);
	}

	for (i = 0, n = parts.length; i < n; i += 1) {
		// プロパティが存在しなければ作成
		if (typeof parent[parts[i]] === "undefined") {
			parent[parts[i]] = {};
		}
		parent = parent[parts[i]];
	}
	return parent;
};

