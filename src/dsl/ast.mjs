export class Expr {
    constructor(origin) {
        this.origin = origin;
        this.type = this.constructor.name;
    }
}

export class ForAll extends Expr {
    constructor(varName, domain, body, origin) {
        super(origin);
        this.varName = varName;
        this.domain = domain;
        this.body = body;
    }
}

export class Exists extends Expr {
    constructor(varName, domain, body, origin) {
        super(origin);
        this.varName = varName;
        this.domain = domain;
        this.body = body;
    }
}

export class And extends Expr {
    constructor(args, origin) {
        super(origin);
        this.args = args;
    }
}

export class Or extends Expr {
    constructor(args, origin) {
        super(origin);
        this.args = args;
    }
}

export class Not extends Expr {
    constructor(arg, origin) {
        super(origin);
        this.arg = arg;
    }
}

export class Implies extends Expr {
    constructor(lhs, rhs, origin) {
        super(origin);
        this.lhs = lhs;
        this.rhs = rhs;
    }
}

export class Iff extends Expr {
    constructor(lhs, rhs, origin) {
        super(origin);
        this.lhs = lhs;
        this.rhs = rhs;
    }
}

export class Xor extends Expr {
    constructor(lhs, rhs, origin) {
        super(origin);
        this.lhs = lhs;
        this.rhs = rhs;
    }
}

export class Predicate extends Expr {
    constructor(name, args, origin) {
        super(origin);
        this.name = name;
        this.args = args;
    }
}

// Terms
export class Term {
    constructor(origin) {
        this.origin = origin;
        this.type = this.constructor.name;
    }
}

export class VarRef extends Term {
    constructor(name, origin) {
        super(origin);
        this.name = name;
    }
}

export class ConstRef extends Term {
    constructor(name, domain, origin) {
        super(origin);
        this.name = name;
        this.domain = domain;
    }
}

export class NumLit extends Term {
    constructor(value, origin) {
        super(origin);
        this.value = value;
    }
}

export class BoolLit extends Term {
    constructor(value, origin) {
        super(origin);
        this.value = value;
    }
}

// Statements
export class VocabularyBlock {
    constructor(declarations, origin) {
        this.declarations = declarations;
        this.origin = origin;
        this.type = 'VocabularyBlock';
    }
}

export class Assert {
    constructor(expr, origin) {
        this.expr = expr;
        this.origin = origin;
        this.type = 'Assert';
    }
}

export class Check {
    constructor(expr, origin) {
        this.expr = expr;
        this.origin = origin;
        this.type = 'Check';
    }
}

export class Definition {
    constructor(name, params, body, origin) {
        this.name = name;
        this.params = params;
        this.body = body;
        this.origin = origin;
        this.type = 'Definition';
    }
}

export class AliasDecl {
    constructor(alias, target, origin) {
        this.alias = alias;
        this.target = target;
        this.origin = origin;
        this.type = 'AliasDecl';
    }
}
