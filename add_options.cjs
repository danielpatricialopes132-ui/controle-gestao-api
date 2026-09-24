
const fs = require("fs");
const path = require("path");

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else {
            if (file.endsWith("route.ts")) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk("c:/Controle-Gestao/backend/app/api");
let count = 0;
const optionsCode = "\nexport async function OPTIONS(request: Request) {\n  return new Response(null, {\n    status: 204,\n    headers: {\n      \"Access-Control-Allow-Origin\": \"*\",\n      \"Access-Control-Allow-Methods\": \"GET, POST, PUT, DELETE, OPTIONS\",\n      \"Access-Control-Allow-Headers\": \"Content-Type, Authorization\",\n    },\n  });\n}\n";

for (const file of files) {
    let content = fs.readFileSync(file, "utf8");
    if (!content.includes("export async function OPTIONS")) {
        content += optionsCode;
        fs.writeFileSync(file, content, "utf8");
        count++;
    }
}
console.log("Added OPTIONS to " + count + " route files");

