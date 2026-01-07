
/**
 * CNL to Sys2DSL Translator - NATURAL LANGUAGE VERSION
 * 
 * CNL is truly natural English:
 *   - "p1 has Fever."        -> @f1 HasFever p1
 *   - "Alice trusts Bob."    -> @f1 Trusts Alice Bob  
 *   - "If p has Flu then p has Fever." -> rule with Implies
 * 
 * NO parentheses in CNL! Natural SVO word order.
 */

export function translate(cnlSource) {
    const lines = cnlSource.split('\n');
    
    const ctx = {
        atoms: [],      // {name, type}
        domains: [],    // names
        boundVars: [],  // Stack of scopes
        output: [],
        implicitDomainUsed: false,
        counts: { rule: 1, f: 1, c: 1, inner: 1, logic: 1 }
    };

    const VAR_TOKEN = '\\$?[A-Za-z_]\\w*';
    const WORD_TOKEN = '[A-Za-z_]\\w*';
    const IMPLICIT_DOMAIN = 'Entity';

    function noteImplicitVar(name, freeVars) {
        if (!freeVars) return;
        if (!freeVars.includes(name)) freeVars.push(name);
    }

    function ensureImplicitDomain() {
        ctx.implicitDomainUsed = true;
    }

    function getVar(name, freeVars) {
        const explicit = name.startsWith('$');
        const rawName = explicit ? name.slice(1) : name;
        for (let i = ctx.boundVars.length - 1; i >= 0; i--) {
            const scope = ctx.boundVars[i];
            const v = scope.find(v => v.name === rawName);
            if (v) return `$${rawName}`;
        }
        if (explicit) {
            if (freeVars) {
                noteImplicitVar(rawName, freeVars);
                return `$${rawName}`;
            }
            return '$error';
        }
        return rawName;
    }

    function add(str) { ctx.output.push(str); }
    function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    /**
     * Parse a natural language expression into AST
     * Supports:
     *   - "x has Fever"      -> {Pred: HasFever, args: [x]}
     *   - "x coughs"         -> {Pred: Coughs, args: [x]}
     *   - "x trusts y"       -> {Pred: Trusts, args: [x, y]}
     *   - "x is Parent of y" -> {Pred: Parent, args: [x, y]}
     *   - "x is Mortal"      -> {Pred: Mortal, args: [x]}
     *   - "A and B"          -> {And: [A, B]}
     *   - Fallback: Pred(x, y) explicit syntax still works
     */
    function parseExpr(str, freeVars) {
        str = str.trim();
        if (str.endsWith('.')) str = str.slice(0, -1);
        
        // "It is not the case that X"
        if (str.toLowerCase().startsWith('it is not the case that')) {
            let inner = str.substring('it is not the case that'.length).trim();
            if (inner.startsWith('(') && inner.endsWith(')')) {
                inner = inner.substring(1, inner.length - 1);
            }
            return { type: 'Not', arg: parseExpr(inner, freeVars) };
        }

        // Biconditional: "A if and only if B" or "A iff B"
        if (str.includes(' if and only if ')) {
            const parts = str.split(' if and only if ');
            if (parts.length === 2) {
                return { type: 'Iff', left: parseExpr(parts[0], freeVars), right: parseExpr(parts[1], freeVars) };
            }
        }
        if (str.includes(' iff ')) {
            const parts = str.split(' iff ');
            if (parts.length === 2) {
                return { type: 'Iff', left: parseExpr(parts[0], freeVars), right: parseExpr(parts[1], freeVars) };
            }
        }

        // Disjunction: "A or B or C"
        if (str.includes(' or ')) {
            const parts = str.split(' or ').map(s => parseExpr(s, freeVars));
            return { type: 'Or', args: parts };
        }

        // Conjunction: "A and B and C"
        if (str.includes(' and ')) {
            const parts = str.split(' and ').map(s => parseExpr(s, freeVars));
            return { type: 'And', args: parts };
        }

        // Explicit fallback: Pred(arg1, arg2) - only for special cases like Succ(n)
        const funcMatch = str.match(/^(\w+)\((.+)\)$/);
        if (funcMatch) {
            const pred = funcMatch[1];
            const argsStr = funcMatch[2];
            const args = parseArgs(argsStr, freeVars);
            return { type: 'Pred', pred, args };
        }

        // Natural patterns (no parentheses):
        
        // "x is Parent of y" / "x is Ancestor of y"
        const relMatch = str.match(new RegExp(`^(${VAR_TOKEN})\\s+is\\s+(${WORD_TOKEN})\\s+of\\s+(${VAR_TOKEN})$`));
        if (relMatch) {
            return { type: 'Pred', pred: relMatch[2], args: [getVar(relMatch[1], freeVars), getVar(relMatch[3], freeVars)] };
        }
        
        // "x is Mortal" / "x is Man" / "x is On" (adjective/state)
        const adjMatch = str.match(new RegExp(`^(${VAR_TOKEN})\\s+is\\s+(${WORD_TOKEN})$`));
        if (adjMatch) {
            return { type: 'Pred', pred: adjMatch[2], args: [getVar(adjMatch[1], freeVars)] };
        }
        
        // "x has Fever" / "x has Flu" / "x has Cold"
        const hasMatch = str.match(new RegExp(`^(${VAR_TOKEN})\\s+has\\s+(${WORD_TOKEN})$`));
        if (hasMatch) {
            const pred = 'Has' + capitalize(hasMatch[2]);
            return { type: 'Pred', pred, args: [getVar(hasMatch[1], freeVars)] };
        }
        
        // "x trusts y" / "x knows y" / "x expresses y" (transitive verb)
        const svoMatch = str.match(new RegExp(`^(${VAR_TOKEN})\\s+(${WORD_TOKEN})\\s+(${VAR_TOKEN})$`));
        if (svoMatch) {
            const pred = capitalize(svoMatch[2]);
            return { type: 'Pred', pred, args: [getVar(svoMatch[1], freeVars), getVar(svoMatch[3], freeVars)] };
        }
        
        // "x coughs" / "x moves" / "x accelerates" (intransitive verb)
        const svMatch = str.match(new RegExp(`^(${VAR_TOKEN})\\s+(${WORD_TOKEN})$`));
        if (svMatch) {
            const pred = capitalize(svMatch[2]);
            return { type: 'Pred', pred, args: [getVar(svMatch[1], freeVars)] };
        }

        // Single atom (variable or constant)
        if (str.match(new RegExp(`^${VAR_TOKEN}$`))) {
            return { type: 'Atom', name: getVar(str, freeVars) };
        }
        
        return { type: 'Error', src: str };
    }

    // Parse comma-separated args for explicit Pred(a, b) fallback
    function parseArgs(argsStr, freeVars) {
        const result = [];
        let depth = 0;
        let current = '';
        for (const ch of argsStr) {
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            else if (ch === ',' && depth === 0) {
                result.push(parseTerm(current.trim(), freeVars));
                current = '';
                continue;
            }
            current += ch;
        }
        if (current.trim()) result.push(parseTerm(current.trim(), freeVars));
        return result;
    }

    function parseTerm(str, freeVars) {
        str = str.trim();
        const funcMatch = str.match(/^(\w+)\((.+)\)$/);
        if (funcMatch) {
            const funcName = funcMatch[1];
            const innerArgs = parseArgs(funcMatch[2], freeVars);
            return { type: 'Func', name: funcName, args: innerArgs };
        }
        return getVar(str, freeVars);
    }

    function generateTerm(term, indent) {
        if (typeof term === 'string') return term;
        if (term.type === 'Func') {
            const argRefs = term.args.map(a => generateTerm(a, indent));
            const id = `func${ctx.counts.logic++}`;
            add(`${indent}@${id} ${term.name} ${argRefs.join(' ')}`);
            return `$${id}`;
        }
        return term;
    }

    function generateLogic(expr, indent) {
        if (expr.type === 'Atom') return expr.name;
        if (expr.type === 'Pred') {
            const id = `c${ctx.counts.c++}`;
            const argRefs = expr.args.map(a => generateTerm(a, indent));
            add(`${indent}@${id} ${expr.pred} ${argRefs.join(' ')}`);
            return `$${id}`;
        }
        if (expr.type === 'And') {
            const argIds = expr.args.map(a => generateLogic(a, indent));
            const id = `and${ctx.counts.logic++}`;
            add(`${indent}@${id} And ${argIds.join(' ')}`);
            return `$${id}`;
        }
        if (expr.type === 'Not') {
            const argId = generateLogic(expr.arg, indent);
            const id = `not${ctx.counts.logic++}`;
            add(`${indent}@${id} Not ${argId}`);
            return `$${id}`;
        }
        if (expr.type === 'Or') {
            const argIds = expr.args.map(a => generateLogic(a, indent));
            const id = `or${ctx.counts.logic++}`;
            add(`${indent}@${id} Or ${argIds.join(' ')}`);
            return `$${id}`;
        }
        if (expr.type === 'Iff') {
            const leftId = generateLogic(expr.left, indent);
            const rightId = generateLogic(expr.right, indent);
            const id = `iff${ctx.counts.logic++}`;
            add(`${indent}@${id} Iff ${leftId} ${rightId}`);
            return `$${id}`;
        }
        return '$error';
    }

    function openImplicitForAll(freeVars, indent, firstLabel) {
        if (!freeVars || freeVars.length === 0) return { labels: [], indent };
        ensureImplicitDomain();
        const labels = [];
        let currentIndent = indent;
        for (let i = 0; i < freeVars.length; i++) {
            const name = freeVars[i];
            const label = (i === 0 && firstLabel) ? firstLabel : `@inner${ctx.counts.inner++}`;
            labels.push(label);
            add(`${currentIndent}${label} ForAll ${IMPLICIT_DOMAIN} graph ${name}`);
            currentIndent += "    ";
            ctx.boundVars.push([{name, type: IMPLICIT_DOMAIN}]);
        }
        return { labels, indent: currentIndent };
    }

    function closeImplicitForAll(labels, indent, bodyId) {
        if (!labels || labels.length === 0) return bodyId;
        if (bodyId) add(`${indent}return ${bodyId}`);
        let currentIndent = indent;
        for (let i = labels.length - 1; i >= 0; i--) {
            ctx.boundVars.pop();
            currentIndent = currentIndent.slice(0, -4);
            add(`${currentIndent}end`);
            if (i > 0) add(`${currentIndent}return $${labels[i].substring(1)}`);
        }
        return `$${labels[0].substring(1)}`;
    }

    // ==================== PASS 0: Load directives ====================
    const loads = [];
    for (const line of lines) {
        const trim = line.trim();
        // load "path/to/file.cnl"
        const loadMatch = trim.match(/^load\s+"([^"]+)"$/);
        if (loadMatch) {
            let path = loadMatch[1];
            // Convert .cnl to .sys2 in output
            if (path.endsWith('.cnl')) {
                path = path.replace(/\.cnl$/, '.sys2');
            }
            loads.push(path);
        }
    }

    // ==================== PASS 1: Declarations ====================
    for (const line of lines) {
        const trim = line.trim();
        if (!trim || trim.startsWith('#') || trim.startsWith('//')) continue;
        if (trim.startsWith('load ')) continue;  // Already processed
        
        // "Let X be a Domain." or "X is a Domain."
        let dm = trim.match(/^Let\s+(\w+)\s+be\s+a\s+Domain\.$/);
        if (dm) { ctx.domains.push(dm[1]); continue; }
        dm = trim.match(/^(\w+)\s+is\s+a\s+Domain\.$/);
        if (dm) { ctx.domains.push(dm[1]); continue; }
        
        // "Let X be a Type." or "X is a Type."
        let am = trim.match(/^Let\s+(\w+)\s+be\s+a\s+(\w+)\.$/);
        if (am && am[2] !== 'Domain') { ctx.atoms.push({name: am[1], type: am[2]}); continue; }
        am = trim.match(/^(\w+)\s+is\s+a\s+(\w+)\.$/);
        if (am && am[2] !== 'Domain') { ctx.atoms.push({name: am[1], type: am[2]}); continue; }
        
        // "Let X, Y, Z be Types." (plural)
        const multiMatch = trim.match(/^Let\s+(.+)\s+be\s+(\w+)\.$/);
        if (multiMatch) {
            const names = multiMatch[1].split(',').map(n => n.trim());
            let type = multiMatch[2];
            // Singularize: Entities->Entity, Persons->Person, Users->User
            if (type.endsWith('ies')) {
                type = type.slice(0, -3) + 'y';  // Entities -> Entity
            } else if (type.endsWith('s')) {
                type = type.slice(0, -1);  // Persons -> Person
            }
            for (const name of names) {
                if (!ctx.atoms.find(a => a.name === name)) {
                    ctx.atoms.push({name, type});
                }
            }
        }
    }

    // Declarations are emitted after logic is processed.

    // ==================== PASS 2: Logic ====================
    let ptr = 0;
    while (ptr < lines.length) {
        let line = lines[ptr].trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) { ptr++; continue; }
        
        // Skip declarations (already processed)
        if (line.startsWith('Let ') || line.match(/^\w+\s+is\s+a\s+\w+\.$/)) { ptr++; continue; }
        
        // Skip load directives (already processed in PASS 0)
        if (line.startsWith('load ')) { ptr++; continue; }

        // Definition block: "Definition: Name <Type var> is:"
        const defMatch = line.match(/^Definition:\s+(\w+)\s+<(\w+)\s+(\w+)>\s+is:$/);
        if (defMatch) {
            const [_, graphName, typeName, varName] = defMatch;
            ptr++;
            add(`@${graphName} graph ${varName}`);
            ctx.boundVars.push([{name: varName, type: typeName}]);
            while (ptr < lines.length) {
                const sub = lines[ptr];
                if (sub.trim() && !sub.startsWith('    ') && !sub.startsWith('\t')) break;
                if (!sub.trim()) { ptr++; continue; }
                const trimSub = sub.trim();
                if (trimSub.match(/^For\s+(all|any|every|each)/i)) {
                    ptr = processForAll(trimSub, lines, ptr, "    ");
                    continue; 
                }
                ptr++;
            }
            add(`end`);
            ctx.boundVars.pop();
            continue;
        }
        
        // Quantified rules: "For all/any/every/each Type x:" or "Each Type x:"
        if (line.match(/^For\s+(all|any|every|each)/i) || line.match(/^(Each|Every)\s+\w+\s+\w+:/)) {
            ptr = processForAll(line, lines, ptr, "");
            continue;
        }

        // Simple conditional: "If X then Y."
        if (line.startsWith('If ')) {
            const ifMatch = line.match(/^If\s+(.+)\s+then\s+(.+)\.?$/);
            if (ifMatch) {
                const freeVars = [];
                const ant = parseExpr(ifMatch[1], freeVars);
                const cons = parseExpr(ifMatch[2], freeVars);
                if (freeVars.length > 0) {
                    const ruleId = `@rule${ctx.counts.rule++}`;
                    const implicit = openImplicitForAll(freeVars, "", ruleId);
                    const antId = generateLogic(ant, implicit.indent);
                    const consId = generateLogic(cons, implicit.indent);
                    const impName = `imp${ctx.counts.logic++}`;
                    add(`${implicit.indent}@${impName} Implies ${antId} ${consId}`);
                    closeImplicitForAll(implicit.labels, implicit.indent, `$${impName}`);
                } else {
                    const ruleId = `@rule${ctx.counts.rule++}`;
                    const antId = generateLogic(ant, "");
                    const consId = generateLogic(cons, "");
                    add(`${ruleId} Implies ${antId} ${consId}`);
                }
            }
            ptr++;
            continue;
        }

        // Probabilistic weight: "Prob(Atom, w)."
        const probMatch = line.match(/^Prob\((.+),\s*([0-9]+(?:\/[0-9]+)?|[0-9]*\.[0-9]+)\)\.?$/);
        if (probMatch) {
            const inner = probMatch[1].trim();
            const weight = probMatch[2].trim();
            const expr = parseExpr(inner);
            if (expr.type === 'Pred') {
                const argRefs = expr.args.map(a => generateTerm(a, ""));
                add(`Weight { ${expr.pred} ${argRefs.join(' ')} } ${weight}`);
            } else if (expr.type === 'Atom') {
                add(`Weight { ${expr.name} } ${weight}`);
            }
            ptr++;
            continue;
        }

        // Fact: natural SVO or explicit Pred(args) or complex expression
        const freeVars = [];
        const expr = parseExpr(line, freeVars);
        if (expr.type === 'Pred') {
            if (freeVars.length > 0) {
                const ruleId = `@rule${ctx.counts.rule++}`;
                const implicit = openImplicitForAll(freeVars, "", ruleId);
                const exprId = generateLogic(expr, implicit.indent);
                closeImplicitForAll(implicit.labels, implicit.indent, exprId);
            } else {
                const fid = `@f${ctx.counts.f++}`;
                const argRefs = expr.args.map(a => generateTerm(a, ""));
                add(`${fid} ${expr.pred} ${argRefs.join(' ')}`);
            }
        } else if (expr.type === 'Not' || expr.type === 'And' || expr.type === 'Or' || expr.type === 'Iff') {
            if (freeVars.length > 0) {
                const ruleId = `@rule${ctx.counts.rule++}`;
                const implicit = openImplicitForAll(freeVars, "", ruleId);
                const exprId = generateLogic(expr, implicit.indent);
                closeImplicitForAll(implicit.labels, implicit.indent, exprId);
            } else {
                // Complex expression as a fact
                generateLogic(expr, "");
            }
        }
        ptr++;
    }

    const finalOutput = [];
    if (loads.length > 0) {
        for (const path of loads) {
            finalOutput.push(`load "${path}"`);
        }
        finalOutput.push('');
    }

    if (ctx.implicitDomainUsed && !ctx.domains.includes(IMPLICIT_DOMAIN)) {
        ctx.domains.push(IMPLICIT_DOMAIN);
    }

    const declLines = [];
    const allTypes = new Set(ctx.domains);
    for (const d of ctx.domains) declLines.push(`@${d}:${d} __Atom`);
    for (const a of ctx.atoms) {
        if (!allTypes.has(a.type)) {
            declLines.push(`@${a.type}:${a.type} __Atom`);
            allTypes.add(a.type);
        }
    }
    for (const a of ctx.atoms) declLines.push(`@${a.name}:${a.name} __Atom`);
    if (ctx.atoms.length > 0) declLines.push('');

    const isALines = [];
    for (const a of ctx.atoms) isALines.push(`IsA ${a.name} ${a.type}`);
    if (ctx.implicitDomainUsed) {
        for (const a of ctx.atoms) isALines.push(`IsA ${a.name} ${IMPLICIT_DOMAIN}`);
    }
    if (ctx.atoms.length > 0) isALines.push('');

    finalOutput.push(...declLines, ...isALines, ...ctx.output);
    return finalOutput.join('\n');

    // ==================== Process ForAll blocks ====================
    function processForAll(header, allLines, startPtr, baseIndent) {
        let afterFor = header.replace(/^(For\s+(all|any|every|each)|Each|Every)\s+/i, '');
        const colonIdx = afterFor.indexOf(':');
        if (colonIdx === -1) return startPtr + 1;
        
        const bindersStr = afterFor.substring(0, colonIdx).trim();
        const vars = parseBinderList(bindersStr);

        let localPtr = startPtr + 1;
        const bodyStmts = [];
        while (localPtr < allLines.length) {
            const nextL = allLines[localPtr];
            if (nextL.trim() === '') { localPtr++; continue; }
            if (!nextL.startsWith(baseIndent + '    ') && !nextL.startsWith(baseIndent + '\t')) break;
            bodyStmts.push(nextL.trim());
            localPtr++;
        }

        for (const stmt of bodyStmts) {
            const ruleId = `@rule${ctx.counts.rule++}`;
            let indent = baseIndent;
            
            const usedVars = vars.filter(v => stmt.includes(v.name));
            const activeVars = usedVars.length > 0 ? usedVars : vars;

            const wrappers = [];
            activeVars.forEach((v, idx) => {
                const label = (idx === 0 && baseIndent === "") ? ruleId : `@inner${ctx.counts.inner++}`;
                wrappers.push({label, varName: v.name});
                add(`${indent}${label} ForAll ${v.type} graph ${v.name}`);
                indent += "    ";
                ctx.boundVars.push([{name: v.name, type: v.type}]);
            });

            let resultId = "";
            const freeVars = [];
            const ifMatch = stmt.match(/^If\s+(.+)\s+then\s+(.+)\.?$/);
            if (ifMatch) {
                const antExpr = parseExpr(ifMatch[1], freeVars);
                const consExpr = parseExpr(ifMatch[2], freeVars);
                const implicit = openImplicitForAll(freeVars, indent);
                const antId = generateLogic(antExpr, implicit.indent);
                const consId = generateLogic(consExpr, implicit.indent);
                const impName = `imp${ctx.counts.logic++}`;
                add(`${implicit.indent}@${impName} Implies ${antId} ${consId}`);
                resultId = closeImplicitForAll(implicit.labels, implicit.indent, `$${impName}`);
            } else if (stmt.includes(' if and only if ') || stmt.includes(' iff ')) {
                // Biconditional inside ForAll
                const expr = parseExpr(stmt.replace(/\.$/, ''), freeVars);
                const implicit = openImplicitForAll(freeVars, indent);
                const exprId = generateLogic(expr, implicit.indent);
                resultId = closeImplicitForAll(implicit.labels, implicit.indent, exprId);
            } else {
                const notMatch = stmt.match(/^It is not the case that\s+(.+)\.?$/);
                if (notMatch || stmt.startsWith('It is not')) {
                    const expr = parseExpr(stmt.replace(/\.$/, ''), freeVars);
                    const implicit = openImplicitForAll(freeVars, indent);
                    const exprId = generateLogic(expr, implicit.indent);
                    resultId = closeImplicitForAll(implicit.labels, implicit.indent, exprId);
                } else {
                    // General expression (including Or, predicates, etc.)
                    const expr = parseExpr(stmt.replace(/\.$/, ''), freeVars);
                    if (expr.type !== 'Error') {
                        const implicit = openImplicitForAll(freeVars, indent);
                        const exprId = generateLogic(expr, implicit.indent);
                        resultId = closeImplicitForAll(implicit.labels, implicit.indent, exprId);
                    }
                }
            }
            
            if (resultId) add(`${indent}return ${resultId}`);

            for (let k = wrappers.length - 1; k >= 0; k--) {
                ctx.boundVars.pop();
                indent = indent.slice(0, -4);
                add(`${indent}end`);
                if (k > 0) add(`${indent}return $${wrappers[k].label.substring(1)}`);
            }
        }
        return localPtr;
    }

    function parseBinderList(str) {
        const result = [];
        const parts = str.split(',').map(s => s.trim());
        let lastType = null;
        
        for (const part of parts) {
            const tokens = part.split(/\s+/);
            if (tokens.length === 2) {
                lastType = tokens[0];
                result.push({type: tokens[0], name: tokens[1]});
            } else if (tokens.length === 1 && lastType) {
                result.push({type: lastType, name: tokens[0]});
            }
        }
        return result;
    }
}
