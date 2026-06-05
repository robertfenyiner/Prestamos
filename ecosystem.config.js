module.exports = {
  apps: [
    {
      name: "prestamos-backend",
      cwd: "./backend",
      script: "dist/index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3002
      }
    }
  ]
};
