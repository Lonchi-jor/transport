import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = process.env.PORT || "43147";
const target = `http://127.0.0.1:${PORT}`;
const outFile = resolve(process.cwd(), ".tunnel-url");

console.log(`Opening an HTTPS tunnel to ${target}`);
console.log("Scan the QR in the app, or open the printed URL on your phone.\n");

const child = spawn(
  "npx",
  ["--yes", "cloudflared", "tunnel", "--url", target],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let found = false;

function ingest(buf) {
  const text = buf.toString();
  process.stderr.write(text);
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match && !found) {
    found = true;
    writeFileSync(outFile, match[0]);
    writeFileSync("/tmp/transitlive-tunnel-url", match[0]);
    console.log("\n========================================");
    console.log("Phone URL:", match[0]);
    console.log("Open that link on your mobile browser.");
    console.log("Add to Home Screen for an app-like icon.");
    console.log("========================================\n");
  }
}

child.stdout.on("data", ingest);
child.stderr.on("data", ingest);
child.on("exit", (code) => {
  process.exit(code ?? 1);
});
