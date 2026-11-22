module.exports = {
  apps: [
    {
      name: "satsway-api",
      cwd: __dirname,
      script: "./scripts/start-api.sh",
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
    {
      name: "satsway-web",
      cwd: `${__dirname}/frontend`,
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "satsway-worker",
      cwd: __dirname,
      script: "./scripts/start-worker.sh",
    },
    {
      name: "satsway-beat",
      cwd: __dirname,
      script: "./scripts/start-beat.sh",
    },
  ],
};
