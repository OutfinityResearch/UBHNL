export function injectBuiltins(vocab) {
    // Built-in Domains
    vocab.addDomain('Entity');
    vocab.addDomain('Bool');
    vocab.addDomain('Int');
    vocab.addDomain('Nat');
    vocab.addDomain('Real');
    vocab.addDomain('String');

    // Built-in Constants
    vocab.addConst('true', 'Bool');
    vocab.addConst('false', 'Bool');

    // Built-in Predicates (DS-19)
    vocab.addPredicate('Equal', ['Entity', 'Entity']);
    vocab.addPredicate('NotEqual', ['Entity', 'Entity']);
    
    vocab.addPredicate('LessThan', ['Int', 'Int']);
    vocab.addPredicate('LessEqual', ['Int', 'Int']);
    vocab.addPredicate('GreaterThan', ['Int', 'Int']);
    vocab.addPredicate('GreaterEqual', ['Int', 'Int']);

    // Built-in Functions
    vocab.addFunction('Add', ['Int', 'Int'], 'Int');
    vocab.addFunction('Sub', ['Int', 'Int'], 'Int');
    vocab.addFunction('Mul', ['Int', 'Int'], 'Int');
    vocab.addFunction('Div', ['Int', 'Int'], 'Int');
    vocab.addFunction('Mod', ['Int', 'Int'], 'Int');
    vocab.addFunction('Neg', ['Int'], 'Int');
    vocab.addFunction('Abs', ['Int'], 'Int');
    vocab.addFunction('Min', ['Int', 'Int'], 'Int');
    vocab.addFunction('Max', ['Int', 'Int'], 'Int');
}
