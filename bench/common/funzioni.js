// Elenca le funzioni di un file TypeScript con le righe di inizio e fine (AST TypeScript del repository della consegna).
// Uso: node funzioni.js <repo> <file relativo>  → JSON [{nome, inizio, fine}]
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
const caricaModulo = createRequire(import.meta.url);
const [repo, file] = process.argv.slice(2);
const ts = caricaModulo(path.join(repo, "node_modules", "typescript"));
const testo = fs.readFileSync(path.join(repo, file), "utf8");
const sorgente = ts.createSourceFile(file, testo, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const funzioni = [];
function nome(nodo) {
  if (nodo.name && nodo.name.text) return nodo.name.text;
  const p = nodo.parent;
  if (p && ts.isVariableDeclaration(p) && p.name.text) return p.name.text;
  if (p && ts.isPropertyAssignment(p) && p.name.text) return p.name.text;
  return "(anonima)";
}
function visita(nodo) {
  if (ts.isFunctionDeclaration(nodo) || ts.isFunctionExpression(nodo) || ts.isArrowFunction(nodo) || ts.isMethodDeclaration(nodo)) {
    funzioni.push({ nome: nome(nodo), inizio: sorgente.getLineAndCharacterOfPosition(nodo.getStart()).line + 1,
                    fine: sorgente.getLineAndCharacterOfPosition(nodo.getEnd()).line + 1 });
  }
  ts.forEachChild(nodo, visita);
}
visita(sorgente);
process.stdout.write(JSON.stringify(funzioni));
