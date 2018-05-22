if (process.env.NODE_ENV !== "production") {
  require("dotenv").load();
}

var child_process = require("child_process");

const Koa = require("koa");
const app = new Koa();

app.use(async ctx => {
  ctx.body = "Hello World";
  res = child_process.execSync(
    "cd scripts && python template_matching.py ../ocr-data/test-images/captchaDraw.png"
  );
  console.log(res.toString());
});

app.listen(process.env.PORT);
