module.exports = {
  apps: [
    {
      name: "boafo",
      script: "src/server/main.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      cwd: "/opt/boafo",
      instances: 2,
      exec_mode: "cluster",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
      },
      error_file: "/var/log/boafo/error.log",
      out_file: "/var/log/boafo/out.log",
      merge_logs: true,
    },
  ],
};
