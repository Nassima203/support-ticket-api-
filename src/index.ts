import { env } from "./config/env";
import { app } from "./app";

app.listen(env.PORT, () => {
  console.log(`API démarrée sur http://localhost:${env.PORT}`);
});
