if (process.env.NODE_ENV !== "production") {
  require("dotenv").load();
}
var moment = require("moment");
var delay = require("delay");
var url = require("url");
var _ = require("lodash");
var path = require("path");
var compression = require("compression");

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
// use compression
app.use(compression());
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

  // send ping packets to prevent heroku h15 idling error
  var id = setInterval(function() {
    ws.send(
      JSON.stringify({
        type: "ping",
        data: "ping"
      })
    );
  }, 20000);

  ws.on("close", function() {
    clearInterval(id);
  });
});

const bodyParser = require("body-parser");
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

// retry request
var retryRequest = async (
  data,
  dontCheckErrorMessage = false,
  maxRetries = 10
) => {
  counter = 0;
  while (true) {
    counter += 1;
    try {
      response = await request({
        ...data,
        timeout: 3000
      });
      if (!dontCheckErrorMessage && response) {
        if (JSON.parse(response).errorMessage) {
          throw Error("Error: " + JSON.parse(response).errorMessage);
        }
      }
      return response;
    } catch (e) {
      if (
        e.message != "Error: ETIMEDOUT" &&
        e.message != "Error: ESOCKETTIMEDOUT"
      )
        console.log(e);
      if (counter >= maxRetries) {
        // throw the error, recipient will handle it
        throw e;
      }
      // sendOther(clientId, "train", JSON.stringify(e));
    }
  }
};

var solveCaptcha = async (jar, idx) => {
  img = await retryRequest(
    {
      uri: "http://www.indianrail.gov.in/enquiry/captchaDraw.png?1526986453735",
      method: "GET",
      gzip: true,
      encoding: null,
      jar
    },
    true
  );
  fs.writeFileSync(`/tmp/image${idx}.png`, img, "binary");
  val = child_process.execSync(
    `cd scripts && python template_matching.py /tmp/image${idx}.png 2>/dev/null`
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
  // get sourceStation, destinationStation, etc. from client req
  const { sourceStation, destinationStation, date, clientId } = req.body;
  var numJars = 10;
  var jars = _.range(numJars).map(() => request.jar());
  res.json("OK");

  sendInfo(clientId, "Fetching CAPTCHAs...");
  var nums = await Promise.all(jars.map((jar, idx) => solveCaptcha(jar, idx)));
  console.log(nums);
  // console.log(jars);

  // sleep?
  await delay(100);
  var dt = moment(date).format("DD-MM-YYYY");
  // now get the trains. use first jar
  sendInfo(clientId, "Getting Trains...");
  try {
    response = await retryRequest(
      {
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
      },
      false,
      1
    );
    if (!response) throw Error("Error: No response. Did you forget date?");
  } catch (e) {
    console.log(e);
    sendOther(clientId, "error", e.message);
    return;
  }
  response = JSON.parse(response);
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
      toStnCode,
      arrivalTime,
      departureTime,
      duration
    } = train;
    var traintype = trainType[0];
    for (let classc of avlClasses) {
      counter += 1;
      var idx = counter % numJars;
      trainRequestsArrays[idx].push({
        other: {
          arrivalTime,
          departureTime,
          duration
        },
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
  sendInfo(
    clientId,
    `Found ${response.trainBtwnStnsList.length} trains. Fetching schedules...`
  );
  sendOther(clientId, "numFetches", counter);
  promises = trainRequestsArrays.map(async trainRequests => {
    for (let trainRequest of trainRequests) {
      await delay(100);
      try {
        response = await retryRequest({
          uri: "http://www.indianrail.gov.in/enquiry/CommonCaptcha",
          method: "GET",
          ...trainRequest
        });
        modifiedResponse = {
          ...JSON.parse(response),
          trainNo: trainRequest.qs.trainNo,
          classc: trainRequest.qs.classc,
          ...trainRequest.other
        };
        sendOther(clientId, "train", JSON.stringify(modifiedResponse));
      } catch (e) {
        // cannot proceed with this req, send an error to client
        sendOther(clientId, "error", `${e.message}`);
      }
    }
    return;
  });
  await Promise.all(promises);
  sendOther(clientId, "done", "ok");
  console.log("done");
  // sendInfo(clientId, "Done.");
});

// react
if (process.env.NODE_ENV == "production") {
  console.log("prod env");
  app.use(express.static(path.join(__dirname, "./client/build")));

  app.get("/*", function(req, res) {
    res.sendFile(path.join(__dirname, "./client/build", "index.html"));
  });
}

// app.listen(process.env.PORT, () =>
//   console.log(`Example app listening on port ${process.env.PORT}!`)
// );
app.disable("x-powered-by");
server.listen(process.env.PORT);
