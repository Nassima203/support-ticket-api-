import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

// Le contrat de l'API, écrit dans docs/openapi.yaml à la racine du projet
// (le même chemin marche depuis src/ avec tsx et depuis dist/ après le build)
const specPath = path.join(__dirname, "..", "..", "docs", "openapi.yaml");

export const openapiSpec = parse(fs.readFileSync(specPath, "utf8"));
