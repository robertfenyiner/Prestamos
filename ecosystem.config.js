module.exports = {
  apps: [
    {
      name: "robertapp-backend",
      script: "C:/proyectos/node-22/node.exe",
      args: "node_modules/tsx/dist/cli.mjs watch src/index.ts",
      cwd: "C:/proyectos/RobertApp/backend",
      env: {
        NODE_ENV: "production",
        PORT: 3001
      }
    },
    {
      name: "robertapp-frontend",
      script: "C:/proyectos/node-22/node.exe",
      args: "node_modules/vite/bin/vite.js preview --host --port 5173",
      cwd: "C:/proyectos/RobertApp/frontend",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
