/**
 * Highlighter SQL minimalista do sqlview-er.
 * Sem dependências: a página roda em file://, então nada de CDN.
 * Gera HTML com spans .tok-* a partir de texto SQL escapado.
 */

const SQLHighlighter = (() => {
  const KEYWORDS = (
    'CREATE|TABLE|TEMPORARY|TRIGGER|PROCEDURE|FUNCTION|VIEW|INDEX|DATABASE|SCHEMA|' +
    'PRIMARY|FOREIGN|KEY|REFERENCES|CONSTRAINT|UNIQUE|NOT|NULL|DEFAULT|AUTO_INCREMENT|' +
    'UNSIGNED|ZEROFILL|COMMENT|ENGINE|CHARSET|CHARACTER|COLLATE|IF|EXISTS|DROP|ALTER|' +
    'ADD|COLUMN|INSERT|INTO|VALUES|UPDATE|DELETE|SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|' +
    'INNER|OUTER|CROSS|ON|USING|AS|AND|OR|XOR|IS|IN|BETWEEN|LIKE|LIMIT|ORDER|GROUP|' +
    'BY|HAVING|UNION|ALL|DISTINCT|BEGIN|END|DECLARE|SET|CALL|RETURN|RETURNS|' +
    'DETERMINISTIC|DELIMITER|BEFORE|AFTER|INSTEAD|OF|FOR|EACH|ROW|NEW|OLD|THEN|ELSE|' +
    'ELSEIF|WHILE|LOOP|REPEAT|UNTIL|CASE|WHEN|CASCADE|RESTRICT|NO|ACTION|DEFINER|' +
    'SQL|SECURITY|INVOKER|READS|MODIFIES|DATA|LOCK|TABLES|UNLOCK|WRITE|READ'
  );

  const TYPES = (
    'INT|INTEGER|BIGINT|MEDIUMINT|SMALLINT|TINYINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|' +
    'BIT|BOOLEAN|BOOL|VARCHAR|CHAR|TEXT|TINYTEXT|MEDIUMTEXT|LONGTEXT|BLOB|TINYBLOB|' +
    'MEDIUMBLOB|LONGBLOB|BINARY|VARBINARY|DATE|DATETIME|TIMESTAMP|TIME|YEAR|ENUM|' +
    'JSON|GEOMETRY|POINT|SERIAL'
  );

  // Ordem importa: comentário de bloco, strings, comentário de linha,
  // identificador com crase, número, tipo, palavra-chave
  const TOKEN_RE = new RegExp(
    '(\\/\\*[\\s\\S]*?\\*\\/)' +
    "|('(?:[^'\\\\]|\\\\.)*'?)" +
    '|("(?:[^"\\\\]|\\\\.)*"?)' +
    '|(--[^\\n]*|#[^\\n]*)' +
    '|(`[^`\\n]*`?)' +
    '|\\b(\\d+(?:\\.\\d+)?)\\b' +
    '|\\b(' + TYPES + ')\\b' +
    '|\\b(' + KEYWORDS + ')\\b',
    'gi'
  );

  function escapeHtml(src) {
    return src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlight(src) {
    return escapeHtml(src).replace(TOKEN_RE,
      (m, blockCom, str1, str2, lineCom, backtick, num, type, kw) => {
        if (blockCom || lineCom) return '<span class="tok-com">' + m + '</span>';
        if (str1 || str2) return '<span class="tok-str">' + m + '</span>';
        if (backtick) return '<span class="tok-id">' + m + '</span>';
        if (num) return '<span class="tok-num">' + m + '</span>';
        if (type) return '<span class="tok-type">' + m + '</span>';
        if (kw) return '<span class="tok-kw">' + m + '</span>';
        return m;
      });
  }

  return { highlight };
})();

window.SQLHighlighter = SQLHighlighter;
