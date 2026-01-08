export function varRef(name, domain) {
    return { kind: 'VarRef', name, domain };
}

export function constRef(name, domain) {
    return { kind: 'ConstRef', name, domain };
}

export function pred(name, args) {
    return { kind: 'Pred', name, args };
}

export function andExpr(lhs, rhs) {
    return { kind: 'And', lhs, rhs };
}

export function orExpr(lhs, rhs) {
    return { kind: 'Or', lhs, rhs };
}

export function notExpr(expr) {
    return { kind: 'Not', expr };
}

export function impliesExpr(lhs, rhs) {
    return { kind: 'Implies', lhs, rhs };
}

export function iffExpr(lhs, rhs) {
    return { kind: 'Iff', lhs, rhs };
}

export function eqExpr(lhs, rhs) {
    return { kind: 'Eq', lhs, rhs };
}

export function forAll(varName, domain, body) {
    return { kind: 'ForAll', var: { name: varName, domain }, body };
}

export function exists(varName, domain, body) {
    return { kind: 'Exists', var: { name: varName, domain }, body };
}

export function boolLit(value) {
    return { kind: 'BoolLit', value: Boolean(value) };
}

export function assertStmt(expr) {
    return { kind: 'Assert', expr };
}
