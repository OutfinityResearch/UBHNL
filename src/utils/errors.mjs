export const E_DSL_SYNTAX = 'E_DSL_SYNTAX';
export const E_DSL_TWO_AT = 'E_DSL_TWO_AT';
export const E_DSL_AT_IN_EXPR = 'E_DSL_AT_IN_EXPR';
export const E_UNKNOWN_SYMBOL = 'E_UNKNOWN_SYMBOL';
export const E_TYPE_MISMATCH = 'E_TYPE_MISMATCH';
export const E_CERT_MISSING = 'E_CERT_MISSING';
export const E_INTERNAL_ERROR = 'E_INTERNAL_ERROR';
export const E_DSL_UNBOUND_VAR = 'E_DSL_UNBOUND_VAR';
export const E_DSL_REDECLARATION = 'E_DSL_REDECLARATION';
export const E_DSL_MISSING_RETURN = 'E_DSL_MISSING_RETURN';
export const E_DSL_MISSING_END = 'E_DSL_MISSING_END';
export const E_DSL_ORPHAN_KB_NAME = 'E_DSL_ORPHAN_KB_NAME';
export const E_DSL_ABSOLUTE_PATH = 'E_DSL_ABSOLUTE_PATH';
export const E_DSL_CIRCULAR_LOAD = 'E_DSL_CIRCULAR_LOAD';
export const E_UNKNOWN_TYPE = 'E_UNKNOWN_TYPE';

/**
 * @typedef {Object} Origin
 * @property {string} sourceId
 * @property {number} line
 * @property {number} column
 * @property {string} [snippet]
 * @property {string} format
 */

/**
 * @typedef {Object} ErrorReport
 * @property {boolean} ok
 * @property {Object} error
 * @property {string} error.kind
 * @property {string} error.code
 * @property {string} error.message
 * @property {string} error.blame
 * @property {Origin} [error.origin]
 * @property {Object} [error.details]
 */

export class UbhnlError extends Error {
    /**
     * @param {string} code
     * @param {string} message
     * @param {'UserInput'|'TheoryFile'|'System'} blame
     * @param {Origin} [origin]
     * @param {Object} [details]
     */
    constructor(code, message, blame, origin, details) {
        super(message);
        this.code = code;
        this.kind = this.inferKind(code);
        this.blame = blame;
        this.origin = origin;
        this.details = details;
    }

    inferKind(code) {
        if (code.startsWith('E_DSL_')) return 'ParseError';
        if (code.startsWith('E_UNKNOWN_') || code.startsWith('E_TYPE_')) return 'TypeError';
        if (code.startsWith('E_CERT_')) return 'CertificateError';
        return 'InternalError';
    }

    toReport() {
        return {
            ok: false,
            error: {
                kind: this.kind,
                code: this.code,
                message: this.message,
                blame: this.blame,
                origin: this.origin,
                details: this.details
            }
        };
    }

    toString() {
        let str = `[${this.kind}] ${this.message}`;
        if (this.origin) {
            str += `\n  at ${this.origin.sourceId}:${this.origin.line}:${this.origin.column}`;
            if (this.origin.snippet) {
                str += `\n     ${this.origin.snippet}`;
                str += `\n     ^`;
            }
        }
        return str;
    }
}
