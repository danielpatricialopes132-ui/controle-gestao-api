
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
const newOptions = `export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}`;

for (const file of files) {
    let content = fs.readFileSync(file, "utf8");
    content = content.replace(/export async function OPTIONS[\s\S]+?\}\n/g, "");
    if (!content.includes("export async function OPTIONS")) {
        content += "\n" + newOptions + "\n";
        fs.writeFileSync(file, content, "utf8");
        count++;
    }
}
console.log("Updated OPTIONS in " + count + " route files");

