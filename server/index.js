const http = require("http");
const express = require("express");
const { Server: SocketServer } = require("socket.io");
const pty = require("node-pty");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const cors = require("cors");
const server = http.createServer(app);
const io = new SocketServer({ cors: "*" });

const ptyProcess = pty.spawn("bash", [], {
  name: "xterm-color",
  cols: 80,
  rows: 30,
  cwd: process.env.INIT_CWD + "/user",
  env: process.env,
});

app.use(cors());

io.attach(server);

ptyProcess.onData((data) => {
  io.emit("terminal:data", data);
});

app.get("/files", async (req, res) => {
  const fileTree = await generateFileTree("./user");
  return res.json({ tree: fileTree });
});

io.on("connection", (socket) => {
  console.log("Socket Connected: ", socket.id);
  socket.on("terminal:write", (data) => {
    ptyProcess.write(data);
  });
});

server.listen(9000, () => {
  console.log("Server is running");
});

async function generateFileTree(directory) {
  const tree = {};

  async function buildTree(currentDir, currentTree) {
    const files = await fs.readdir(currentDir);

    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        currentTree[file] = {};
        await buildTree(filePath, currentTree[file]);
      } else {
        currentTree[file] = null;
      }
    }
  }

  await buildTree(directory, tree);
  return tree;
}
