/**
 * SQL DDL Schema Parser for sqldesigner
 */

class SQLParser {
  /**
   * Parse SQL DDL and return schema object with tables and relationships.
   * @param {string} sql 
   * @returns {{tables: Object, relationships: Array}}
   */
  static parse(sql) {
    const tables = {};
    const relationships = [];

    // 1. Clean comments and normalize whitespaces
    const cleanedSql = this.cleanComments(sql);
    
    // 2. Extract CREATE TABLE statements
    const rawStatements = this.extractCreateTableStatements(cleanedSql);

    // 3. First pass: parse table names and column definitions
    for (const statement of rawStatements) {
      const { tableName, body } = statement;
      
      if (tables[tableName]) {
        // Table already exists, overwrite or ignore? We can ignore or merge.
        // Let's overwrite to keep it simple.
        tables[tableName] = {
          name: tableName,
          columns: [],
          columnMap: new Map() // temporary Map for quick lookup
        };
      } else {
        tables[tableName] = {
          name: tableName,
          columns: [],
          columnMap: new Map()
        };
      }

      // Split the body by commas outside of parentheses
      const parts = this.splitByCommasOutsideParens(body);
      const tableConstraints = [];

      for (const part of parts) {
        const trimmed = part.trim().replace(/\s+/g, ' ');
        if (!trimmed) continue;

        if (this.isTableConstraint(trimmed)) {
          tableConstraints.push(trimmed);
        } else {
          // Parse column definition
          const colDef = this.parseColumnDefinition(trimmed, tableName, relationships);
          if (colDef) {
            tables[tableName].columns.push(colDef);
            tables[tableName].columnMap.set(colDef.name, colDef);
          }
        }
      }

      // Store constraints to process in the second pass (after all tables are created)
      tables[tableName].rawConstraints = tableConstraints;
    }

    // 4. Second pass: Process table-level constraints for all tables
    for (const tableName in tables) {
      const table = tables[tableName];
      const rawConstraints = table.rawConstraints || [];

      for (const constraint of rawConstraints) {
        this.processTableConstraint(constraint, table, tables, relationships);
      }

      // Delete the temporary Map and rawConstraints before returning
      delete table.columnMap;
      delete table.rawConstraints;
    }

    // 5. Extract triggers, procedures and functions plus their table links
    const routines = {};
    const routineLinks = [];
    this.extractRoutines(cleanedSql, tables, routines, routineLinks);

    return { tables, relationships, routines, routineLinks };
  }

  /**
   * Extract CREATE TRIGGER / PROCEDURE / FUNCTION and link them to the
   * tables they reference in their bodies.
   */
  static extractRoutines(sql, tables, routines, routineLinks) {
    let m;

    // Triggers: CREATE [DEFINER=...] TRIGGER name BEFORE|AFTER event ON table
    const trigRe = /CREATE\s+(?:DEFINER\s*=\s*\S+\s+)?TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"\[\]\w.$]+)\s+(BEFORE|AFTER|INSTEAD\s+OF)\s+(INSERT|UPDATE|DELETE)\s+(?:OF\s+[\w`",\s]+\s+)?ON\s+([`"\[\]\w.$]+)/gi;
    while ((m = trigRe.exec(sql)) !== null) {
      const name = this.stripQuotes(m[1]);
      const timing = m[2].toUpperCase().replace(/\s+/g, ' ');
      const event = m[3].toUpperCase();
      const onTable = this.stripQuotes(m[4]);
      if (!name) continue;

      const body = this.extractRoutineBody(sql, trigRe.lastIndex);
      const routine = { name, kind: 'trigger', label: `${timing} ${event}`, onTable, refs: [] };
      routines[name] = routine;

      if (tables[onTable]) {
        routineLinks.push({ routine: name, table: onTable, type: 'on' });
      }
      this.findTableRefs(body, tables).forEach(t => {
        if (t !== onTable) {
          routine.refs.push(t);
          routineLinks.push({ routine: name, table: t, type: 'ref' });
        }
      });
    }

    // Procedures and functions
    const procRe = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:DEFINER\s*=\s*\S+\s+)?(PROCEDURE|FUNCTION)\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"\[\]\w.$]+)\s*\(/gi;
    while ((m = procRe.exec(sql)) !== null) {
      const kind = m[1].toLowerCase() === 'procedure' ? 'procedure' : 'function';
      const name = this.stripQuotes(m[2]);
      if (!name || routines[name]) continue;

      const body = this.extractRoutineBody(sql, procRe.lastIndex);
      const routine = { name, kind, label: kind === 'procedure' ? 'PROCEDURE' : 'FUNCTION', refs: [] };
      routines[name] = routine;

      this.findTableRefs(body, tables).forEach(t => {
        routine.refs.push(t);
        routineLinks.push({ routine: name, table: t, type: 'ref' });
      });
    }
  }

  /**
   * Heuristic body extraction: the routine body runs until the next CREATE
   * statement or DELIMITER switch (bodies contain ';', so we can't split on it)
   */
  static extractRoutineBody(sql, startIdx) {
    const rest = sql.slice(startIdx);
    const endMatch = /\b(?:DELIMITER\b|CREATE\s+(?:DEFINER|OR\s+REPLACE|TEMP|TEMPORARY|TABLE|TRIGGER|PROCEDURE|FUNCTION|VIEW|INDEX)\b)/i.exec(rest);
    return endMatch ? rest.slice(0, endMatch.index) : rest;
  }

  /**
   * Find known tables referenced in a routine body via FROM/JOIN/INTO/UPDATE/TABLE
   */
  static findTableRefs(body, tables) {
    const found = [];
    for (const tableName in tables) {
      const esc = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('\\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\\s+[`"\\[]?' + esc + '(?:[`"\\]]|(?![\\w$]))', 'i');
      if (re.test(body)) found.push(tableName);
    }
    return found;
  }

  /**
   * Clean comments from SQL
   */
  static cleanComments(sql) {
    if (!sql) return '';
    return sql
      // Unwrap MySQL conditional comments keeping the content — dumps put
      // triggers/procedures inside /*!50003 CREATE ... */ blocks
      .replace(/\/\*!\d*\s?([\s\S]*?)\*\//g, '$1')
      .replace(/\/\*[\s\S]*?\*\//g, '') // remove multi-line comments /* ... */
      .replace(/--.*$/gm, '')           // remove SQL single line comments -- ...
      .replace(/#.*$/gm, '');           // remove MySQL single line comments # ...
  }

  /**
   * Extract table name and body from CREATE TABLE statements
   */
  static extractCreateTableStatements(sql) {
    const statements = [];
    let idx = 0;

    while (true) {
      const match = /CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TABLE\s+/gi.exec(sql.slice(idx));
      if (!match) break;

      const startIdx = idx + match.index;
      const createTableEndIdx = startIdx + match[0].length;

      // Find the first opening parenthesis after CREATE TABLE
      const openParenIdx = sql.indexOf('(', createTableEndIdx);
      if (openParenIdx === -1) {
        idx = createTableEndIdx; // move forward to search next
        continue;
      }

      // Table name is between CREATE TABLE and the '('
      let rawTableName = sql.slice(createTableEndIdx, openParenIdx).trim();
      rawTableName = rawTableName.replace(/IF\s+NOT\s+EXISTS/gi, '').trim();
      const tableName = this.stripQuotes(rawTableName);

      if (!tableName) {
        idx = openParenIdx + 1;
        continue;
      }

      // Find matching closing parenthesis by counting depth
      let depth = 1;
      let closeParenIdx = -1;
      for (let i = openParenIdx + 1; i < sql.length; i++) {
        if (sql[i] === '(') depth++;
        else if (sql[i] === ')') depth--;

        if (depth === 0) {
          closeParenIdx = i;
          break;
        }
      }

      if (closeParenIdx === -1) {
        // Parenthesis mismatch, move forward
        idx = openParenIdx + 1;
        continue;
      }

      const body = sql.slice(openParenIdx + 1, closeParenIdx).trim();
      statements.push({ tableName, body });

      idx = closeParenIdx + 1;
    }

    return statements;
  }

  /**
   * Split string by commas, but only when commas are outside of parentheses.
   * Useful for splitting column definitions inside CREATE TABLE (columns, constraints, etc.)
   */
  static splitByCommasOutsideParens(str) {
    const parts = [];
    let current = '';
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      
      // Handle string quotes so we don't count parentheses/commas inside strings
      if (char === "'" && !inDoubleQuote && !inBacktick) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote && !inBacktick) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inBacktick = !inBacktick;
      }

      if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
        if (char === '(') depth++;
        else if (char === ')') depth--;
      }

      if (char === ',' && depth === 0 && !inSingleQuote && !inDoubleQuote && !inBacktick) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  /**
   * Determine if a trimmed line is a table-level constraint
   */
  static isTableConstraint(line) {
    const upper = line.toUpperCase();
    return (
      upper.startsWith('CONSTRAINT ') ||
      upper.startsWith('PRIMARY KEY') ||
      upper.startsWith('FOREIGN KEY') ||
      upper.startsWith('UNIQUE') ||
      upper.startsWith('CHECK') ||
      upper.startsWith('KEY ') || // MySQL key index
      upper.startsWith('INDEX ')
    );
  }

  /**
   * Parse a column definition line
   */
  static parseColumnDefinition(line, tableName, relationships) {
    const tokens = line.split(/\s+/);
    if (tokens.length < 2) return null;

    const rawColName = tokens[0];
    const colName = this.stripQuotes(rawColName);
    if (!colName) return null;

    // Determine type by collecting subsequent tokens until a constraint keyword is met
    const constraintKeywords = [
      'NOT', 'NULL', 'PRIMARY', 'UNIQUE', 'REFERENCES', 'DEFAULT', 
      'AUTO_INCREMENT', 'AUTOINCREMENT', 'GENERATED', 'CONSTRAINT', 
      'CHECK', 'COLLATE', 'COMMENT', 'ON', 'AS'
    ];

    let typeParts = [];
    let i = 1;
    for (; i < tokens.length; i++) {
      const tokenUpper = tokens[i].toUpperCase();
      // Check if this token starts a constraint keyword
      if (constraintKeywords.includes(tokenUpper)) {
        break;
      }
      typeParts.push(tokens[i]);
    }

    const type = typeParts.join(' ');
    const remainingText = tokens.slice(i).join(' ');
    const upperRemaining = remainingText.toUpperCase();

    // Parse options
    const isPK = upperRemaining.includes('PRIMARY KEY');
    const isUnique = upperRemaining.includes('UNIQUE');
    const isNullable = !upperRemaining.includes('NOT NULL');
    
    // Check for inline foreign key
    // E.g., user_id INT REFERENCES users(id) ON DELETE CASCADE
    let isFK = false;
    const refMatch = /REFERENCES\s+([a-zA-Z0-9_`".#-]+)\s*\(([^)]+)\)/i.exec(remainingText);
    if (refMatch) {
      isFK = true;
      const toTable = this.stripQuotes(refMatch[1]);
      const toCol = this.stripQuotes(refMatch[2]);
      
      relationships.push({
        fromTable: tableName,
        fromCol: colName,
        toTable: toTable,
        toCol: toCol,
        name: `fk_${tableName}_${colName}`
      });
    }

    return {
      name: colName,
      type: type || 'VARCHAR',
      isPK,
      isFK,
      isUnique,
      isNullable
    };
  }

  /**
   * Process a table-level constraint
   */
  static processTableConstraint(line, table, allTables, relationships) {
    let cleanLine = line.replace(/\s+/g, ' ');
    const upper = cleanLine.toUpperCase();

    // Strip CONSTRAINT name if present
    if (upper.startsWith('CONSTRAINT ')) {
      const tokens = cleanLine.split(' ');
      // format: CONSTRAINT constraint_name PRIMARY KEY...
      // Remove first two tokens
      cleanLine = tokens.slice(2).join(' ');
    }

    const upperClean = cleanLine.toUpperCase();

    // 1. Table-level PRIMARY KEY
    // E.g., PRIMARY KEY (col1, col2)
    if (upperClean.startsWith('PRIMARY KEY')) {
      const pkMatch = /PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(cleanLine);
      if (pkMatch) {
        const pkCols = pkMatch[1].split(',').map(c => this.stripQuotes(c));
        for (const colName of pkCols) {
          const col = table.columnMap.get(colName);
          if (col) {
            col.isPK = true;
          }
        }
      }
    }

    // 2. Table-level FOREIGN KEY
    // E.g., FOREIGN KEY (user_id) REFERENCES users(id)
    else if (upperClean.startsWith('FOREIGN KEY')) {
      const fkMatch = /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s*([a-zA-Z0-9_`".#-]+)\s*\(([^)]+)\)/i.exec(cleanLine);
      if (fkMatch) {
        const fkCols = fkMatch[1].split(',').map(c => this.stripQuotes(c));
        const refTable = this.stripQuotes(fkMatch[2]);
        const refCols = fkMatch[3].split(',').map(c => this.stripQuotes(c));

        // Connect columns individually (composite foreign keys are represented as multiple links)
        const minLen = Math.min(fkCols.length, refCols.length);
        for (let i = 0; i < minLen; i++) {
          const fromCol = fkCols[i];
          const toCol = refCols[i];

          // Set FK flag on column
          const col = table.columnMap.get(fromCol);
          if (col) {
            col.isFK = true;
          }

          relationships.push({
            fromTable: table.name,
            fromCol: fromCol,
            toTable: refTable,
            toCol: toCol,
            name: `fk_${table.name}_${fromCol}`
          });
        }
      }
    }

    // 3. Table-level UNIQUE
    // E.g., UNIQUE (col1, col2)
    else if (upperClean.startsWith('UNIQUE')) {
      const uniqueMatch = /UNIQUE\s*(?:\s+\w+)?\s*\(([^)]+)\)/i.exec(cleanLine);
      if (uniqueMatch) {
        const uniqueCols = uniqueMatch[1].split(',').map(c => this.stripQuotes(c));
        for (const colName of uniqueCols) {
          const col = table.columnMap.get(colName);
          if (col) {
            col.isUnique = true;
          }
        }
      }
    }
  }

  /**
   * Strip quotes, brackets and schema prefixes from identifiers
   */
  static stripQuotes(str) {
    if (!str) return '';
    const parts = str.trim().split('.');
    const raw = parts.pop().trim();
    return raw
      .replace(/^\[|\]$/g, '')          // Strip SQL Server square brackets [dbo]
      .replace(/^[`'"]|[`'"]$/g, '')     // Strip backticks or quotes
      .replace(/^\[|\]$/g, '')          // Strip brackets again if nested
      .replace(/^[`'"]|[`'"]$/g, '')     // Strip quotes again if nested
      .trim();
  }
}

window.SQLParser = SQLParser;

