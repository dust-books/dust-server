import { Application, Router } from '@oak/oak';

const router = new Router();

const app = new Application();

app.use(router.routes());
app.use(router.allowedMethods());

app.listen();