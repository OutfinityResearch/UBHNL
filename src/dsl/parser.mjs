import { Tokenizer, TokenType } from './tokenizer.mjs';
import * as AST from './ast.mjs';
import { UbhnlError, E_DSL_SYNTAX, E_DSL_TWO_AT, E_DSL_MISSING_END } from '../utils/errors.mjs';

export function parseDSL(source, sourceId) {
    const tokenizer = new Tokenizer(source, sourceId);
    const program = [];

    while (!tokenizer.isEOF()) {
        const stmt = parseStatement(tokenizer);
        if (stmt) program.push(stmt);
    }

    return program;
}

function parseStatement(t) {
    const token = t.peek();
    if (token.type === TokenType.EOF) return null;

    if (token.type === TokenType.KEYWORD) {
        if (token.value === 'Vocab') return parseVocabBlock(t);
        if (token.value === 'Assert') return parseAssert(t);
        if (token.value === 'Check') return parseCheck(t);
        if (token.value === 'Alias') return parseAlias(t);
    }

    if (token.type === TokenType.SYMBOL && token.value === '@') {
        return parseDeclaration(t);
    }

    // Anonymous assertion (implicit Assert)
    const expr = parseExpr(t);
    return new AST.Assert(expr, expr.origin);
}

function parseVocabBlock(t) {
    const start = t.next(); // Vocab
    const declarations = [];

    while (!t.isEOF()) {
        const token = t.peek();
        if (token.type === TokenType.KEYWORD && token.value === 'end') {
            t.next(); // consume end
            return new AST.VocabularyBlock(declarations, { ...start, format: 'DSL' });
        }
        
        // Inside vocab: Domain, Const, Pred, Func, Alias
        declarations.push(parseVocabItem(t));
    }
    
    throw new UbhnlError(E_DSL_MISSING_END, "Vocab block missing 'end'", 'UserInput', start);
}

function parseVocabItem(t) {
    const token = t.next();
    // Simplified: just consuming tokens until newline logic... 
    // Actually, tokenizer swallows newlines, so we rely on keywords like Domain/Const
    // But since `Vocab` block structure is keyword-driven, we just parse known keywords.
    
    // For MVP prototype: We construct generic objects. 
    // Real implementation needs specific classes for DomainDecl, ConstDecl, etc.
    // Here we'll just parse identifiers.
    
    const args = [];
    while (t.peek().type === TokenType.IDENT) {
        args.push(t.next().value);
    }
    
    return { kind: token.value, args, origin: token };
}

function parseDeclaration(t) {
    const at = t.next(); // @
    const name = t.next(); // ident
    
    if (name.type !== TokenType.IDENT) {
        throw new UbhnlError(E_DSL_SYNTAX, "Expected identifier after @", 'UserInput', at);
    }

    // Check for :kbName
    let kbName = null;
    if (t.peek().value === ':') {
        t.next();
        kbName = t.next().value;
    }

    // Lookahead for construct type
    const next = t.peek();
    
    if (next.value === 'ForAll') return parseQuantified(t, name.value, 'ForAll');
    if (next.value === 'Exists') return parseQuantified(t, name.value, 'Exists');
    if (next.value === 'graph') return parseDefinition(t, name.value);
    
    // Named expression or Atom declaration
    if (next.value === '__Atom') {
        t.next();
        // TODO: Handle Atom decl
        return { kind: 'AtomDecl', name: name.value, kbName };
    }

    const expr = parseExpr(t);
    // TODO: Return NamedExpr wrapper
    return new AST.Assert(expr, at); // Temporary: treat as assert
}

function parseQuantified(t, name, kind) {
    const start = t.next(); // ForAll/Exists
    const type = t.next().value;
    t.next(); // graph
    const varName = t.next().value;

    const body = []; // TODO: parse body statements until return
    
    // Skipping to end for MVP parser skeleton
    while (t.peek().value !== 'end' && !t.isEOF()) {
        t.next();
    }
    t.next(); // end

    const Origin = { ...start, format: 'DSL' };
    return kind === 'ForAll' 
        ? new AST.ForAll(varName, type, body, Origin)
        : new AST.Exists(varName, type, body, Origin);
}

function parseExpr(t) {
    // Recursive parsing for And/Or/Not/Pred
    const token = t.peek();

    if (token.value === '{') {
        t.next();
        const expr = parseExpr(t);
        const close = t.next();
        if (close.value !== '}') throw new UbhnlError(E_DSL_SYNTAX, "Expected '}'", 'UserInput', close);
        return expr;
    }

    if (token.type === TokenType.KEYWORD) {
        return parseConnective(t);
    }

    if (token.type === TokenType.IDENT) {
        return parsePredicate(t);
    }

    if (token.value === '$') {
        return parseVarRef(t);
    }
    
    throw new UbhnlError(E_DSL_SYNTAX, `Unexpected token in expression: ${token.value}`, 'UserInput', token);
}

function parseConnective(t) {
    const op = t.next();
    const kind = op.value;
    
    if (kind === 'Not') {
        const arg = parseExpr(t);
        return new AST.Not(arg, op);
    }

    if (['And', 'Or', 'Implies', 'Iff', 'Xor'].includes(kind)) {
        const lhs = parseExpr(t);
        const rhs = parseExpr(t);
        
        // Handle n-ary And/Or if needed, but for now binary
        if (kind === 'And') return new AST.And([lhs, rhs], op);
        if (kind === 'Or') return new AST.Or([lhs, rhs], op);
        if (kind === 'Implies') return new AST.Implies(lhs, rhs, op);
        if (kind === 'Iff') return new AST.Iff(lhs, rhs, op);
        if (kind === 'Xor') return new AST.Xor(lhs, rhs, op);
    }
    
    throw new UbhnlError(E_DSL_SYNTAX, `Unknown connective: ${kind}`, 'UserInput', op);
}

function parsePredicate(t) {
    const name = t.next();
    const args = [];
    
    // Greedily consume terms
    while (isTermStart(t.peek())) {
        args.push(parseTerm(t));
    }
    
    return new AST.Predicate(name.value, args, name);
}

function parseTerm(t) {
    const token = t.peek();
    if (token.value === '$') return parseVarRef(t);
    if (token.type === TokenType.IDENT) {
        const id = t.next();
        return new AST.ConstRef(id.value, null, id);
    }
    if (token.type === TokenType.NUMBER) {
        const n = t.next();
        return new AST.NumLit(n.value, n);
    }
    throw new UbhnlError(E_DSL_SYNTAX, "Invalid term", 'UserInput', token);
}

function parseVarRef(t) {
    t.next(); // $
    const id = t.next();
    return new AST.VarRef(id.value, id);
}

function isTermStart(token) {
    return token.value === '$' || token.type === TokenType.IDENT || token.type === TokenType.NUMBER;
}

function parseAssert(t) {
    const start = t.next();
    const expr = parseExpr(t);
    return new AST.Assert(expr, start);
}

function parseCheck(t) {
    const start = t.next();
    const expr = parseExpr(t);
    return new AST.Check(expr, start);
}

function parseAlias(t) {
    const start = t.next();
    const alias = t.next().value;
    const target = t.next().value;
    return new AST.AliasDecl(alias, target, start);
}

function parseDefinition(t, name) {
    // TODO: Implement
    return null;
}
