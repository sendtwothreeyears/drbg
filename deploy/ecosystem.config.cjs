module.exports = {
  apps: [
    {
      name: "boafo",
      script: "src/server/main.ts",
      interpreter: "node",
      interpreter_args: "--import tsx --max-old-space-size=384",
      cwd: "/opt/boafo",
      instances: 1,
      exec_mode: "fork",
      kill_timeout: 5000,
      max_memory_restart: "450M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "/var/log/boafo/error.log",
      out_file: "/var/log/boafo/out.log",
      merge_logs: true,
    },
  ],
};
