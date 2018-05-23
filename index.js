if (process.env.NODE_ENV !== "production") {
  require("dotenv").load();
}
var moment = require("moment");
var delay = require("delay");
var url = require("url");
var _ = require("lodash");
// this should save cookies
var request = require("request-promise");
// var jar = request.jar();
request = request.defaults({ /*jar,*/ gzip: true });
// require("request-debug")(request);

require("request").debug = true;
var fs = require("fs");
var child_process = require("child_process");
var http = require("http");

const express = require("express");
const app = express();
let server = http.Server(app);

var ws = require("ws");
let wss = new ws.Server({
  server: server,
  path: "/api"
});

connections = {};

wss.on("connection", (ws, req) => {
  const parameters = url.parse(req.url, true);
  ws.id = parameters.query.id;
  // also add to connections
  connections[ws.id] = ws;
  // wss.clients.forEach(function each(client) {
  //   console.log("Client.ID: " + client.id);
  // });

  // ws.send("something");
});

const bodyParser = require("body-parser");
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

// retry request
var retryRequest = async data => {
  while (true) {
    try {
      response = await request({
        ...data,
        timeout: 3000
      });
      return response;
      break;
    } catch (e) {
      // console.log(e);
      // sendOther(clientId, "train", JSON.stringify(e));
    }
  }
};

var solveCaptcha = async (jar, idx) => {
  img = await retryRequest({
    uri: "http://www.indianrail.gov.in/enquiry/captchaDraw.png?1526986453735",
    method: "GET",
    gzip: true,
    encoding: null,
    jar
  });
  fs.writeFileSync(`/tmp/image${idx}.png`, img, "binary");
  val = child_process.execSync(
    `cd scripts && python template_matching.py /tmp/image${idx}.png`
  );
  return val.toString().trim();
};

// app.get("/api/solveCaptcha", async (req, res) => {
//   res.json(await solveCaptcha());
// });

app.get("/api/fetchAutoComplete", async (req, res) => {
  res.send(
    await request.get("http://www.indianrail.gov.in/enquiry/FetchAutoComplete")
  );
});

var sendInfo = (clientId, data) => {
  if (connections[clientId]) {
    connections[clientId].send(
      JSON.stringify({
        type: "info",
        data
      })
    );
  } else {
    console.log(`client is closed. cant send "${data}"`);
  }
};

var sendOther = (clientId, type, data) => {
  if (connections[clientId]) {
    connections[clientId].send(
      JSON.stringify({
        type,
        data
      })
    );
  } else {
    console.log(`client is closed. cant send "${data}"`);
  }
};
app.post("/api/getTrains", async (req, res) => {
  const { sourceStation, destinationStation, date, clientId } = req.body;
  var numJars = 10;
  var jars = _.range(numJars).map(() => request.jar());
  res.json("OK");

  sendInfo(clientId, "Fetching CAPTCHAs...");
  var nums = await Promise.all(jars.map((jar, idx) => solveCaptcha(jar, idx)));
  console.log(nums);
  // console.log(jars);
  // var num = await solveCaptcha();
  // get sourceStation, destinationStation, date

  // sleep?
  await delay(100);
  var dt = moment(date).format("DD-MM-YYYY");
  // now get the trains
  sendInfo(clientId, "Getting Trains...");
  response = await retryRequest({
    uri: "http://www.indianrail.gov.in/enquiry/CommonCaptcha",
    method: "GET",
    qs: {
      inputCaptcha: nums[0],
      dt,
      sourceStation,
      destinationStation,
      flexiWithDate: "y",
      inputPage: "TBIS",
      language: "en"
    },
    jar: jars[0]
  });
  response = JSON.parse(response);
  if (response.errorMessage) {
    sendInfo(clientId, "Error Fetching Trains.");
    return;
  }
  // console.log(response);
  const { quotaList } = response;
  // wait a bit again
  await delay(200);
  var trainRequestsArrays = _.range(numJars).map(() => []);
  var counter = 0;
  for (let train of response.trainBtwnStnsList) {
    const {
      trainNumber,
      avlClasses,
      trainType,
      fromStnCode,
      toStnCode
    } = train;
    var traintype = trainType[0];
    for (let classc of avlClasses) {
      counter += 1;
      var idx = counter % numJars;
      trainRequestsArrays[idx].push({
        qs: {
          inputCaptcha: nums[idx],
          inputPage: "TBIS_CALL_FOR_FARE",
          trainNo: trainNumber,
          dt,
          sourceStation: fromStnCode,
          destinationStation: toStnCode,
          classc,
          quota: "GN",
          traintype,
          language: "en"
        },
        jar: jars[idx]
      });
    }
  }
  // sendInfo(
  //   clientId,
  //   `Found ${response.trainBtwnStnsList
  //     .length} trains with ${counter} categories.`
  // );
  sendInfo(
    clientId,
    `Found ${response.trainBtwnStnsList.length} trains. Fetching schedules...`
  );
  sendOther(clientId, "numFetches", counter);

  promises = trainRequestsArrays.map(async trainRequests => {
    for (let trainRequest of trainRequests) {
      await delay(100);
      response = await retryRequest({
        uri: "http://www.indianrail.gov.in/enquiry/CommonCaptcha",
        method: "GET",
        ...trainRequest
      });
      modifiedResponse = {
        ...JSON.parse(response),
        trainNo: trainRequest.qs.trainNo,
        classc: trainRequest.qs.classc
      };
      const { errorMessage } = modifiedResponse;
      if (errorMessage) {
        console.log(errorMessage);
        sendOther(clientId, "error", errorMessage);
      }
      sendOther(clientId, "train", JSON.stringify(modifiedResponse));
    }
    return;
  });
  await Promise.all(promises);
  sendOther(clientId, "done", "ok");
  console.log("done");
  sendInfo(clientId, "Done.");
});

// app.listen(process.env.PORT, () =>
//   console.log(`Example app listening on port ${process.env.PORT}!`)
// );
app.disable("x-powered-by");
server.listen(process.env.PORT);
