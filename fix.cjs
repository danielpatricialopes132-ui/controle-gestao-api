const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

walk('app/api').forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const initial = content;
  content = content.replace(/from\s+['"].*?\/lib\/auth['"]/g, "from '@/lib/auth'");
  content = content.replace(/from\s+['"].*?\/lib\/prisma['"]/g, "from '@/lib/prisma'");
  content = content.replace(/from\s+['"].*?\/lib\/firebase-admin['"]/g, "from '@/lib/firebase-admin'");
  if (content !== initial) {
    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
  }
});
