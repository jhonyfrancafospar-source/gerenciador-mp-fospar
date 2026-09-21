import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  buckets: {
    "app-files": { access: "public_read" },
    "uploads": { access: "public_read" },
  },
});
