import { UbhnlError, E_DSL_SYNTAX } from '../utils/errors.mjs';

export const TokenType = {
    KEYWORD: 'KEYWORD',
    IDENT: 'IDENT',
    SYMBOL: 'SYMBOL',
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    EOF: 'EOF'
};

const KEYWORDS = new Set([
    'ForAll', 'Exists', 'Vocab', 'Domain', 'Const', 'Pred', 'Func', 
    'Assert', 'Check', 'And', 'Or', 'Not', 'Implies', 'Iff', 'Xor', 
    'true', 'false', 'Weight', 'ProbQuery', 'Ask', 'Given', 
    'Proof', 'graph', 'return', 'end', 'IsA', 'SubType', 'Alias', '__Atom'
]);

export class Tokenizer {
    constructor(source, sourceId) {
        this.source = source;
        this.sourceId = sourceId;
        this.pos = 0;
        this.line = 1;
        this.col = 1;
    }

    isEOF() {
        return this.pos >= this.source.length;
    }

    peek() {
        if (this._peeked) return this._peeked;
        this._peeked = this._readNext();
        return this._peeked;
    }

    next() {
        if (this._peeked) {
            const t = this._peeked;
            this._peeked = null;
            return t;
        }
        return this._readNext();
    }

    _readNext() {
        this._skipWhitespace();
        if (this.isEOF()) {
            return { type: TokenType.EOF, line: this.line, column: this.col };
        }

        const char = this.source[this.pos];
        const startLine = this.line;
        const startCol = this.col;

        // Symbols
        if ('@$:{}()'.includes(char)) { // Note: () are forbidden in grammar but tokenized here to give better errors
            this._advance();
            return { type: TokenType.SYMBOL, value: char, line: startLine, column: startCol };
        }

        // Numbers
        if (/[0-9]/.test(char)) {
            let value = '';
            while (!this.isEOF() && /[0-9./]/.test(this.source[this.pos])) {
                value += this.source[this.pos];
                this._advance();
            }
            return { type: TokenType.NUMBER, value, line: startLine, column: startCol };
        }

        // Strings
        if (char === '"') {
            this._advance();
            let value = '';
            while (!this.isEOF() && this.source[this.pos] !== '"') {
                value += this.source[this.pos];
                this._advance();
            }
            if (this.isEOF()) {
                throw new UbhnlError(E_DSL_SYNTAX, "Unterminated string literal", 'UserInput', { sourceId: this.sourceId, line: startLine, column: startCol });
            }
            this._advance(); // skip closing quote
            return { type: TokenType.STRING, value, line: startLine, column: startCol };
        }

        // Identifiers & Keywords
        if (/[a-zA-Z_]/.test(char)) {
            let value = '';
            while (!this.isEOF() && /[a-zA-Z0-9_]/.test(this.source[this.pos])) {
                value += this.source[this.pos];
                this._advance();
            }
            
            const type = KEYWORDS.has(value) ? TokenType.KEYWORD : TokenType.IDENT;
            return { type, value, line: startLine, column: startCol };
        }

        throw new UbhnlError(E_DSL_SYNTAX, `Unexpected character: '${char}'`, 'UserInput', { sourceId: this.sourceId, line: startLine, column: startCol });
    }

    _advance() {
        if (this.source[this.pos] === '\n') {
            this.line++;
            this.col = 1;
        } else {
            this.col++;
        }
        this.pos++;
    }

    _skipWhitespace() {
        while (!this.isEOF()) {
            const char = this.source[this.pos];
            if (/\s/.test(char)) {
                this._advance();
            } else if (char === '#') {
                // Comment until EOL
                while (!this.isEOF() && this.source[this.pos] !== '\n') {
                    this._advance();
                }
            } else if (char === '/' && this.source[this.pos + 1] === '/') {
                // // Comment until EOL
                while (!this.isEOF() && this.source[this.pos] !== '\n') {
                    this._advance();
                }
            } else {
                break;
            }
        }
    }
}
